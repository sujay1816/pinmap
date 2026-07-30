// Pulls the pure logic out of index.html so the suites can import it.
//
// The app ships as one self-contained HTML file, which is what makes it work
// from a pen drive with no internet. That leaves the logic inside a <script>
// tag, so this lifts the parts that touch no DOM into tests/core.mjs.
//
// Run it before the suites: npm test does that for you.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "..", "index.html"), "utf8");

const OPEN = '<script>\n"use strict";';
const BANNER = (title) =>
  `/* ============================================================\n   ${title}`;

if (!html.includes(OPEN)) {
  console.error("Could not find the script block in index.html.");
  process.exit(1);
}

const js = html.split(OPEN, 2)[1].split("</script>")[0];

const slice = (from, to) => {
  const a = js.indexOf(from);
  const b = js.indexOf(to, a);
  if (a < 0 || b < 0) {
    console.error(`Could not slice from "${from.slice(0, 40)}" to "${to.slice(0, 40)}".`);
    process.exit(1);
  }
  return js.slice(a, b);
};

const constants = slice("const KINDS", "let uid = 0;");
const merging  = slice("function newerOf(", BANNER("The shared store"));
const helpers   = slice("const allocated =", BANNER("BMP decoding"));
const core      = slice(BANNER("BMP decoding"), BANNER("Validation"));

const stub = `
// A stand-in for the app's state, so the logic can run without a page.
const state = {
  segments: [], borderFiles: [], wefts: [], opts: {},
  totalDeclared: 0, boxMotion: "4x4", weaves: [], boxPrefs: {}
};
state.borderFiles = {};
`;

const exports = `
export {
  decodeBMP, encodeBMP1,
  achuRow, boxRow, boxPlan, defaultBoxPattern, weftBoxPattern, storedBoxFor,
  hasCustomBox, boxPrefKey, closeBandGaps,
  satinRow, satinStep, stepIsValid, gcd,
  rotateCCW, fitToPins,
  SATIN_LIBRARY, BUILTIN_WEAVES, allWeaves, weaveById, weaveRow, satinName,
  BOX_TABLE, compose, state, KINDS, DEFAULT_LAYOUT, labelFor,
  mergeLibraries, newerOf,
  freshWefts, filledWefts, borderSlots, bodySlots,
  WEFT_SLOTS, WEFT_NAMES, totalPins, allocated
};
`;

const out = constants + stub + helpers + core + merging + exports;
fs.writeFileSync(path.join(here, "core.mjs"), out);
console.log(`extracted ${out.length.toLocaleString()} characters to tests/core.mjs`);
