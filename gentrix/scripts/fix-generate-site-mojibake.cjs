/**
 * One-off / repeatable: vervang corrupte mojibake in site-generation user-prompt strings.
 * Draai vanaf package root: node scripts/fix-generate-site-mojibake.cjs
 */
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "lib", "ai", "generate-site-with-claude.ts");
let s = fs.readFileSync(file, "utf8");
const before = (s.match(/\?\?\?/g) || []).length;

s = s.replace(/g\?\?n/g, "geen");
s = s.replace(/\?\?n/g, "een");
s = s.replace(/(\d)\?\?\?(\d)/g, "$1-$2");
s = s.replace(/CTA\?\?\?'s/g, "CTA's");
s = s.replace(/CTA\?\?\?s/g, "CTA's");
s = s.replace(/\(\?\?\?\)/g, "(*)");
s = s.replace(/ \?\?\? /g, " - ");
s = s.replace(/ \?\?\?/g, " -");
s = s.replace(/\?\?\? /g, "- ");
s = s.replace(/\?\?\?/g, " - ");
s = s.replace(/ -  - /g, " - ");
s = s.replace(/` - ` Stijl/g, "`Stijl");

fs.writeFileSync(file, s, "utf8");
const after = (s.match(/\?\?\?/g) || []).length;
console.log(`generate-site-with-claude.ts: ??? count ${before} -> ${after}`);
