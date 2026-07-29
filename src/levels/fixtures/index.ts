import corridor from './corridor.json';
import jumpGap from './jump-gap.json';
import shaft from './shaft.json';

export const FIXTURE_SOURCES: Readonly<Record<string, unknown>> = {
  corridor,
  'jump-gap': jumpGap,
  shaft,
};
