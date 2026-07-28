export const BASE_WIDTH = 320;
export const BASE_HEIGHT = 180;

export interface Viewport {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface CanvasLayout {
  /** Integer scale factor applied to the 320x180 backbuffer in device pixels. */
  scale: number;
  deviceWidth: number;
  deviceHeight: number;
  cssWidth: number;
  cssHeight: number;
  offsetX: number;
  offsetY: number;
}

export function computeCanvasLayout(viewport: Viewport): CanvasLayout {
  const { width, height } = viewport;
  // Guard against a zero/negative dpr from a hostile or misreporting environment.
  const dpr = viewport.devicePixelRatio > 0 ? viewport.devicePixelRatio : 1;

  const scale = Math.max(
    1,
    Math.floor(Math.min((width * dpr) / BASE_WIDTH, (height * dpr) / BASE_HEIGHT)),
  );

  const deviceWidth = BASE_WIDTH * scale;
  const deviceHeight = BASE_HEIGHT * scale;
  const cssWidth = deviceWidth / dpr;
  const cssHeight = deviceHeight / dpr;

  return {
    scale,
    deviceWidth,
    deviceHeight,
    cssWidth,
    cssHeight,
    offsetX: (width - cssWidth) / 2,
    offsetY: (height - cssHeight) / 2,
  };
}
