// Prints every commit of the current branch, oldest first, with its serial number: C1 is the first commit ever, C2 the next, and so on.
// A commit's serial is its position in the history, so the list never needs maintaining. Since C503 the number is also the first word of the
// commit message; C1 to C502 have it as a Git note (refs/notes/serial, shown by `git log --notes=serial`).
//
//   npm run commits                 print the list
//   npm run commits -- --count      print only the total
//   npm run commits -- --out=FILE   also write the list to FILE
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const rows = execFileSync("git", ["log", "--reverse", "--format=%h|%ad|%s", "--date=short"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split("\n")
  .filter(Boolean);

if (args.includes("--count")) {
  console.log(rows.length);
  process.exit(0);
}

const lines = rows.map((row, i) => {
  const [hash, date, ...subject] = row.split("|");
  return `C${i + 1}  ${hash}  ${date}  ${subject.join("|")}`;
});
const out = args.find((a) => a.startsWith("--out="))?.slice(6);
if (out) writeFileSync(out, `# Commits (oldest first): ${rows.length} in total\n\n${lines.join("\n")}\n`, "utf8");
console.log(lines.join("\n"));
console.log(`\n${rows.length} commits in total`);
