// src/tools/**: build-time-only, node-only. Never imported by src/main.ts,
// src/engine/**, or src/render/**.
//
// Hand-rolled indexed PNG encoder. No PNG library and no zlib.deflateSync: the
// deflate stream below is a single stored (uncompressed) block, so the output
// is byte-identical across every Node and zlib build, forever. See
// docs/design/visual-identity.md for the rationale.

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

/** Standard CRC-32 (the polynomial used by PNG chunk trailers, gzip and zlib.crc32). */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const ADLER_MOD = 65521;

/** Standard Adler-32, as used in the zlib stream wrapper around each deflate block. */
export function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]!) % ADLER_MOD;
    b = (b + a) % ADLER_MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(out.buffer);

  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);

  const typeAndData = new Uint8Array(4 + data.length);
  typeAndData.set(typeBytes, 0);
  typeAndData.set(data, 4);
  view.setUint32(8 + data.length, crc32(typeAndData));

  return out;
}

/** A single stored (uncompressed) deflate block wrapped in a minimal zlib stream. */
function storedZlibStream(raw: Uint8Array): Uint8Array {
  // zlib header: CMF/FLG chosen so (CMF*256+FLG) % 31 === 0, CM=8 (deflate), CINFO=7 (32K window).
  const zlibHeader = new Uint8Array([0x78, 0x01]);

  // One stored block, final (BFINAL=1, BTYPE=00). LEN/NLEN are little-endian per the
  // deflate spec even though everything else in PNG chunks is big-endian.
  const blockHeader = new Uint8Array(5);
  blockHeader[0] = 0x01;
  const len = raw.length;
  blockHeader[1] = len & 0xff;
  blockHeader[2] = (len >>> 8) & 0xff;
  blockHeader[3] = ~len & 0xff;
  blockHeader[4] = (~len >>> 8) & 0xff;

  const adlerBytes = new Uint8Array(4);
  new DataView(adlerBytes.buffer).setUint32(0, adler32(raw));

  const out = new Uint8Array(
    zlibHeader.length + blockHeader.length + raw.length + adlerBytes.length,
  );
  let offset = 0;
  out.set(zlibHeader, offset);
  offset += zlibHeader.length;
  out.set(blockHeader, offset);
  offset += blockHeader.length;
  out.set(raw, offset);
  offset += raw.length;
  out.set(adlerBytes, offset);
  return out;
}

export interface EncodeIndexedPngOptions {
  width: number;
  height: number;
  /** One entry per pixel, row-major, values are indices into `palette`. */
  indices: Uint8Array;
  /** RGB entries in PLTE order. Index 0 is treated as the transparent index (alpha 0). */
  palette: ReadonlyArray<readonly [number, number, number]>;
}

/**
 * Encodes a color type 3 (indexed), bit depth 4 PNG with a single stored
 * deflate block and filter type 0 on every scanline. Filtering buys nothing
 * here: with 7 palette entries under stored (uncompressed) compression, the
 * scanlines are never actually compressed, and filter 0 keeps the file
 * trivially decodable in tests.
 */
export function encodeIndexedPng(options: EncodeIndexedPngOptions): Uint8Array {
  const { width, height, indices, palette } = options;

  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdrData[8] = 4; // bit depth
  ihdrData[9] = 3; // color type: indexed
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method

  const plteData = new Uint8Array(palette.length * 3);
  palette.forEach(([r, g, b], i) => {
    plteData[i * 3] = r;
    plteData[i * 3 + 1] = g;
    plteData[i * 3 + 2] = b;
  });

  // Index 0 is the reserved transparent index; every other palette entry defaults to
  // fully opaque and is omitted, per the PNG tRNS chunk's trailing-entries rule.
  const trnsData = new Uint8Array([0]);

  const bytesPerRow = Math.ceil((width * 4) / 8);
  const raw = new Uint8Array((bytesPerRow + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (bytesPerRow + 1);
    raw[rowStart] = 0; // filter type 0 (none)
    for (let x = 0; x < width; x++) {
      const index = indices[y * width + x]!;
      const byteOffset = rowStart + 1 + (x >> 1);
      if (x % 2 === 0) {
        raw[byteOffset] = (index & 0x0f) << 4;
      } else {
        raw[byteOffset] = raw[byteOffset]! | (index & 0x0f);
      }
    }
  }

  const idatData = storedZlibStream(raw);

  const parts = [
    SIGNATURE,
    chunk('IHDR', ihdrData),
    chunk('PLTE', plteData),
    chunk('tRNS', trnsData),
    chunk('IDAT', idatData),
    chunk('IEND', new Uint8Array(0)),
  ];

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
