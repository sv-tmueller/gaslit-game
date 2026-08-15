import wideningGap from './demo-widening-gap.json';
import movingPlatform from './demo-moving-platform.json';
import triggerChange from './demo-trigger-change.json';
import movingExit from './demo-moving-exit.json';
import closingRoute from './demo-closing-route.json';

export const DEMO_LEVELS: Readonly<Record<string, unknown>> = {
  'widening-gap': wideningGap,
  'moving-platform': movingPlatform,
  'trigger-change': triggerChange,
  'moving-exit': movingExit,
  'closing-route': closingRoute,
};
