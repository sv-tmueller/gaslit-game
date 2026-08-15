// World 2 level catalog (#48): 15 original levels built on tier 2 mechanics
// from Milestone 6. Introduces gravity inversion, bombs, levers, jetpack,
// buzzsaws, and springs with escalating difficulty and mutation complexity.

import level16 from "./level-16.json";
import level17 from "./level-17.json";
import level18 from "./level-18.json";
import level19 from "./level-19.json";
import level20 from "./level-20.json";
import level21 from "./level-21.json";
import level22 from "./level-22.json";
import level23 from "./level-23.json";
import level24 from "./level-24.json";
import level25 from "./level-25.json";
import level26 from "./level-26.json";
import level27 from "./level-27.json";
import level28 from "./level-28.json";
import level29 from "./level-29.json";
import level30 from "./level-30.json";

export const WORLD2_LEVELS: Readonly<Record<string, unknown>> = {
  "flipside": level16,
  "ceiling-walk": level17,
  "gravitas": level18,
  "fuse-box": level19,
  "chain-reaction": level20,
  "detonation": level21,
  "switchboard": level22,
  "pressure": level23,
  "mechanism": level24,
  "lift-off": level25,
  "airspace": level26,
  "sustained": level27,
  "bounce-house": level28,
  "timing": level29,
  "world-2-finale": level30,
};

export const WORLD2_SEQUENCE: readonly string[] = [
  "flipside",
  "ceiling-walk",
  "gravitas",
  "fuse-box",
  "chain-reaction",
  "detonation",
  "switchboard",
  "pressure",
  "mechanism",
  "lift-off",
  "airspace",
  "sustained",
  "bounce-house",
  "timing",
  "world-2-finale",
];
