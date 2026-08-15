// World 3 level catalog (#48): 15 original levels built on tier 3 mechanics
// and meta-trolls from Milestone 7. Features rotating arms, moving terrain,
// control inversion, camera trolls, fake UI, and teleporters with maximum
// mutation density and meta-troll variety.

import level31 from "./level-31.json";
import level32 from "./level-32.json";
import level33 from "./level-33.json";
import level34 from "./level-34.json";
import level35 from "./level-35.json";
import level36 from "./level-36.json";
import level37 from "./level-37.json";
import level38 from "./level-38.json";
import level39 from "./level-39.json";
import level40 from "./level-40.json";
import level41 from "./level-41.json";
import level42 from "./level-42.json";
import level43 from "./level-43.json";
import level44 from "./level-44.json";
import level45 from "./level-45.json";

export const WORLD3_LEVELS: Readonly<Record<string, unknown>> = {
  "spin-cycle": level31,
  "blade-corridor": level32,
  "multi-arm": level33,
  "ride-the-wave": level34,
  "sync-ride": level35,
  "hybrid-hop": level36,
  "mirror-mirror": level37,
  "reverse-commute": level38,
  "inverted-gauntlet": level39,
  "vertigo": level40,
  "funhouse": level41,
  "perception": level42,
  "glitch": level43,
  "portal-maze": level44,
  "world-3-finale": level45,
};

export const WORLD3_SEQUENCE: readonly string[] = [
  "spin-cycle",
  "blade-corridor",
  "multi-arm",
  "ride-the-wave",
  "sync-ride",
  "hybrid-hop",
  "mirror-mirror",
  "reverse-commute",
  "inverted-gauntlet",
  "vertigo",
  "funhouse",
  "perception",
  "glitch",
  "portal-maze",
  "world-3-finale",
];
