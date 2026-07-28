import { BASE_HEIGHT, BASE_WIDTH, computeCanvasLayout } from './scale';

// Placeholder fill until game logic exists; proves the deploy pipeline end to end.
const PLACEHOLDER_COLOR = '#1b1b2f';

function bootstrap(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  // Offscreen backbuffer at the fixed internal resolution; the visible canvas is
  // an integer-scaled blit of this, which keeps scaling logic in one place.
  const backbuffer = document.createElement('canvas');
  backbuffer.width = BASE_WIDTH;
  backbuffer.height = BASE_HEIGHT;

  const backCtx = backbuffer.getContext('2d');
  if (!backCtx) {
    throw new Error('2d context unavailable on the backbuffer');
  }

  backCtx.fillStyle = PLACEHOLDER_COLOR;
  backCtx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  function render(): void {
    const layout = computeCanvasLayout({
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    });

    canvas.width = layout.deviceWidth;
    canvas.height = layout.deviceHeight;
    canvas.style.width = `${layout.cssWidth}px`;
    canvas.style.height = `${layout.cssHeight}px`;
    canvas.style.left = `${layout.offsetX}px`;
    canvas.style.top = `${layout.offsetY}px`;

    // Must be reset after every resize since changing canvas.width/height resets the context.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(backbuffer, 0, 0, canvas.width, canvas.height);
  }

  render();
  window.addEventListener('resize', render);
}

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) {
  throw new Error('missing #game-canvas element');
}

const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('2d context unavailable on #game-canvas');
}

bootstrap(canvas, ctx);
