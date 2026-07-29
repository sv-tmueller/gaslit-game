export type InputAction = 'left' | 'right' | 'jump' | 'restart' | 'pause';

const ACTIONS: readonly InputAction[] = ['left', 'right', 'jump', 'restart', 'pause'];

export interface InputSnapshot {
  readonly held: Readonly<Record<InputAction, boolean>>;
  readonly pressed: Readonly<Record<InputAction, boolean>>;
  readonly released: Readonly<Record<InputAction, boolean>>;
}

export type KeyBindings = Readonly<Record<InputAction, readonly string[]>>;

export const DEFAULT_BINDINGS: KeyBindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'ArrowUp'],
  restart: ['KeyR'],
  pause: ['KeyP', 'Escape'],
};

export interface KeyboardInput {
  keyDown(code: string): void;
  keyUp(code: string): void;
  blur(): void;
  isBound(code: string): boolean;
  sample(): InputSnapshot;
}

function emptyRecord(): Record<InputAction, boolean> {
  const record = {} as Record<InputAction, boolean>;
  for (const action of ACTIONS) {
    record[action] = false;
  }
  return record;
}

export function createKeyboardInput(bindings: KeyBindings = DEFAULT_BINDINGS): KeyboardInput {
  const codeToAction = new Map<string, InputAction>();
  for (const action of ACTIONS) {
    for (const code of bindings[action]) {
      codeToAction.set(code, action);
    }
  }

  const downCodes = new Set<string>();
  const held = emptyRecord();
  const pressed = emptyRecord();
  const released = emptyRecord();

  function isActionHeld(action: InputAction): boolean {
    for (const code of bindings[action]) {
      if (downCodes.has(code)) {
        return true;
      }
    }
    return false;
  }

  function recomputeHeld(action: InputAction): void {
    const next = isActionHeld(action);
    if (next === held[action]) {
      return;
    }
    held[action] = next;
    if (next) {
      pressed[action] = true;
    } else {
      released[action] = true;
    }
  }

  function setCode(code: string, isDown: boolean): void {
    const action = codeToAction.get(code);
    if (action === undefined) {
      return;
    }
    if (isDown) {
      downCodes.add(code);
    } else {
      downCodes.delete(code);
    }
    recomputeHeld(action);
  }

  return {
    keyDown(code: string): void {
      setCode(code, true);
    },
    keyUp(code: string): void {
      setCode(code, false);
    },
    blur(): void {
      for (const code of [...downCodes]) {
        setCode(code, false);
      }
    },
    isBound(code: string): boolean {
      return codeToAction.has(code);
    },
    // Call once per simulation step, never once per substep: with the max
    // 5 substeps clamp, a catch-up burst would otherwise consume each edge
    // on its first substep and starve the later substeps of it.
    sample(): InputSnapshot {
      const snapshot: InputSnapshot = Object.freeze({
        held: Object.freeze({ ...held }),
        pressed: Object.freeze({ ...pressed }),
        released: Object.freeze({ ...released }),
      });
      for (const action of ACTIONS) {
        pressed[action] = false;
        released[action] = false;
      }
      return snapshot;
    },
  };
}
