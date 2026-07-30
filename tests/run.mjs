// Runs every suite and reports one summary.
//
//   npm test          logic and interface
//   npm run test:logic
//   npm run test:ui

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const which = process.argv[2] || "all";

const listing = (dir) =>
  fs.existsSync(path.join(here, dir))
    ? fs.readdirSync(path.join(here, dir)).filter(f => f.endsWith(".mjs")).sort()
    : [];

const groups = [];
if (which === "all" || which === "logic") groups.push(["logic", listing("logic"), []]);
if (which === "all" || which === "ui")    groups.push(["ui", listing("ui"), [path.join(here, "..", "index.html")]]);

let failed = 0;
let checks = 0;

for (const [name, files, args] of groups) {
  if (!files.length) continue;
  console.log(`\n──── ${name} ────`);
  for (const f of files) {
    const r = spawnSync(process.execPath, [path.join(here, name, f), ...args], { encoding: "utf8" });
    const out = (r.stdout || "") + (r.stderr || "");
    const tally = out.match(/(\d+) passed, (\d+) failed/);
    const noErr = /no errors/.test(out);
    const bad = r.status !== 0;

    if (tally) checks += parseInt(tally[1], 10);
    if (bad) failed++;

    const label = tally ? `${tally[1]} passed, ${tally[2]} failed`
                        : noErr ? "clean"
                        : bad ? "failed" : "done";
    console.log(`  ${bad ? "FAIL" : "ok  "}  ${name}/${f.padEnd(22)} ${label}`);
    if (bad) {
      console.log(out.split("\n").filter(l => /FAIL|Error|problem/.test(l)).slice(0, 12)
        .map(l => "        " + l.trim()).join("\n"));
    }
  }
}

console.log(`\n${checks} checks · ${failed ? failed + " suite(s) failed" : "everything passed"}\n`);
process.exit(failed ? 1 : 0);
