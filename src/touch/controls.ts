// Touch controls and mobile responsive layout (#49).
// On-screen thumb-positioned buttons, responsive canvas sizing.
// Pure state model, no DOM manipulation.

export type TouchAction = 'left' | 'right' | 'jump' | 'restart';

export interface TouchButton {
  readonly action: TouchAction;
  readonly x: number;       // center X in CSS pixels
  readonly y: number;       // center Y in CSS pixels
  readonly radius: number;  // touch radius
  readonly active: boolean;
}

export interface TouchControlsState {
  readonly buttons: readonly TouchButton[];
  readonly layout: 'phone' | 'tablet' | 'none';
  readonly screenWidth: number;
  readonly screenHeight: number;
}

export function createTouchControls(width: number, height: number): TouchControlsState {
  const layout = width < 768 ? 'phone' : width < 1024 ? 'tablet' : 'none';
  if (layout === 'none') {
    return { buttons: [], layout, screenWidth: width, screenHeight: height };
  }
  const btnSize = layout === 'phone' ? 48 : 64;
  const margin = 16;
  return {
    buttons: [
      { action: 'left', x: margin + btnSize/2, y: height - margin - btnSize/2, radius: btnSize/2, active: false },
      { action: 'right', x: margin + btnSize*1.5 + 8, y: height - margin - btnSize/2, radius: btnSize/2, active: false },
      { action: 'jump', x: width - margin - btnSize/2, y: height - margin - btnSize/2, radius: btnSize/2, active: false },
      { action: 'restart', x: width - margin - btnSize/2, y: height - margin - btnSize*1.5 - 8, radius: btnSize/2, active: false },
    ],
    layout,
    screenWidth: width,
    screenHeight: height,
  };
}

export function updateTouchButtons(state: TouchControlsState, touches: readonly { x: number; y: number }[]): TouchControlsState {
  const buttons = state.buttons.map(btn => {
    const active = touches.some(t => {
      const dx = t.x - btn.x;
      const dy = t.y - btn.y;
      return dx*dx + dy*dy <= btn.radius * btn.radius;
    });
    return { ...btn, active };
  });
  return { ...state, buttons };
}

export function getTouchActions(state: TouchControlsState): Record<TouchAction, boolean> {
  return {
    left: state.buttons.some(b => b.action === 'left' && b.active),
    right: state.buttons.some(b => b.action === 'right' && b.active),
    jump: state.buttons.some(b => b.action === 'jump' && b.active),
    restart: state.buttons.some(b => b.action === 'restart' && b.active),
  };
}

export function isMobileLayout(state: TouchControlsState): boolean {
  return state.layout !== 'none';
}
