// src/tools/**: build-time-only, node-only. Never imported by src/main.ts,
// src/engine/**, or src/render/**.
import { inflateSync, crc32 as zlibCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { adler32, crc32, encodeIndexedPng } from './png.ts';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

interface Chunk {
  type: string;
  data: Uint8Array;
  crc: number;
}

function readChunks(png: Uint8Array): Chunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Chunk[] = [];
  let offset = 8;
  while (offset < png.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const data = png.subarray(offset + 8, offset + 8 + length);
    const crc = view.getUint32(offset + 8 + length);
    chunks.push({ type, data, crc });
    offset += 12 + length;
  }
  return chunks;
}

describe('adler32', () => {
  it('matches the known checksum of "abc"', () => {
    expect(adler32(new TextEncoder().encode('abc'))).toBe(0x024d0127);
  });
});

describe('crc32', () => {
  it('matches node:zlib crc32 for arbitrary bytes', () => {
    const bytes = new TextEncoder().encode('IHDR + some chunk data');
    expect(crc32(bytes)).toBe(zlibCrc32(bytes));
  });
});

describe('encodeIndexedPng', () => {
  const palette: Array<readonly [number, number, number]> = [
    [0, 0, 0],
    [10, 20, 30],
    [40, 50, 60],
    [70, 80, 90],
  ];

  it('starts with the PNG signature bytes', () => {
    const png = encodeIndexedPng({
      width: 1,
      height: 1,
      indices: new Uint8Array([0]),
      palette,
    });

    expect(Array.from(png.subarray(0, 8))).toEqual(SIGNATURE);
  });

  it('writes an IHDR chunk with the requested dimensions and indexed-color fields', () => {
    const png = encodeIndexedPng({
      width: 3,
      height: 1,
      indices: new Uint8Array([1, 2, 3]),
      palette,
    });

    const ihdr = readChunks(png).find((chunk) => chunk.type === 'IHDR');
    if (!ihdr) throw new Error('missing IHDR');
    const view = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);

    expect(view.getUint32(0)).toBe(3); // width
    expect(view.getUint32(4)).toBe(1); // height
    expect(ihdr.data[8]).toBe(4); // bit depth
    expect(ihdr.data[9]).toBe(3); // color type: indexed
    expect(ihdr.data[10]).toBe(0); // compression method
    expect(ihdr.data[11]).toBe(0); // filter method
    expect(ihdr.data[12]).toBe(0); // interlace method
  });

  it('every chunk CRC matches node:zlib crc32 over type plus data', () => {
    const png = encodeIndexedPng({
      width: 3,
      height: 1,
      indices: new Uint8Array([1, 2, 3]),
      palette,
    });

    for (const chunk of readChunks(png)) {
      const typeAndData = new Uint8Array(4 + chunk.data.length);
      typeAndData.set(new TextEncoder().encode(chunk.type), 0);
      typeAndData.set(chunk.data, 4);
      expect(chunk.crc).toBe(zlibCrc32(typeAndData));
    }
  });

  it('packs an odd width with the trailing nibble as 0', () => {
    const png = encodeIndexedPng({
      width: 3,
      height: 1,
      indices: new Uint8Array([1, 2, 3]),
      palette,
    });

    const idat = readChunks(png).find((chunk) => chunk.type === 'IDAT');
    if (!idat) throw new Error('missing IDAT');
    const scanlines = inflateSync(idat.data);

    // filter byte 0, then ceil(3 * 4 / 8) = 2 packed bytes: (1<<4|2), (3<<4|0)
    expect(Array.from(scanlines)).toEqual([0, 0x12, 0x30]);
  });

  it('produces the expected filter-0 scanlines for a small hand-built image', () => {
    const png = encodeIndexedPng({
      width: 2,
      height: 2,
      indices: new Uint8Array([1, 2, 3, 0]),
      palette,
    });

    const idat = readChunks(png).find((chunk) => chunk.type === 'IDAT');
    if (!idat) throw new Error('missing IDAT');
    const scanlines = inflateSync(idat.data);

    // Two rows, each: filter byte 0 then ceil(2*4/8) = 1 packed byte.
    expect(Array.from(scanlines)).toEqual([0, 0x12, 0, 0x30]);
  });

  it('returns byte-identical output for two calls with the same input', () => {
    const options = {
      width: 3,
      height: 1,
      indices: new Uint8Array([1, 2, 3]),
      palette,
    };

    const first = encodeIndexedPng(options);
    const second = encodeIndexedPng(options);

    expect(Array.from(first)).toEqual(Array.from(second));
  });
});
