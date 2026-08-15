// MVP level catalog (#30): 15 original levels forming a deliberate teaching
// curve. Each JSON is imported as a raw source blob and re-exported through
// MVP_LEVELS (map) and MVP_SEQUENCE (ordered list).

import level01 from "./level-01.json";
import level02 from "./level-02.json";
import level03 from "./level-03.json";
import level04 from "./level-04.json";
import level05 from "./level-05.json";
import level06 from "./level-06.json";
import level07 from "./level-07.json";
import level08 from "./level-08.json";
import level09 from "./level-09.json";
import level10 from "./level-10.json";
import level11 from "./level-11.json";
import level12 from "./level-12.json";
import level13 from "./level-13.json";
import level14 from "./level-14.json";
import level15 from "./level-15.json";

export const MVP_LEVELS: Readonly<Record<string, unknown>> = {
  "first-lie": level01,
  "second-thoughts": level02,
  "spike-room": level03,
  "the-crusher": level04,
  "closingwalls": level05,
  "fake-door": level06,
  "combo-1": level07,
  "combo-2": level08,
  "the-gauntlet": level09,
  "trust-issues": level10,
  "maze-of-doors": level11,
  "mutation-intro": level12,
  "mutation-shift": level13,
  "mutation-trap": level14,
  "finale": level15,
};

export const MVP_SEQUENCE: readonly string[] = [
  "first-lie",
  "second-thoughts",
  "spike-room",
  "the-crusher",
  "closingwalls",
  "fake-door",
  "combo-1",
  "combo-2",
  "the-gauntlet",
  "trust-issues",
  "maze-of-doors",
  "mutation-intro",
  "mutation-shift",
  "mutation-trap",
  "finale",
];
