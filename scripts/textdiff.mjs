// 承認用の「変更点の一覧」を Markdown で出す（修正前 → 修正後、前後の文つき）
// 使い方: node scripts/textdiff.mjs <比較元 例: origin/main>
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { config, extractTexts, diffTexts, editFile, unbundle, ROOT } from "./lib.mjs";

const base = process.argv[2] || "origin/main";
const show = (ref, file) => {
  try { return execFileSync("git", ["show", `${ref}:${file}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return ""; }
};
const cell = (s) => (s == null ? "—" : s.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 160));

let md = "## 変更点の一覧（承認用）\n\n";
let total = 0;
for (const p of config.pages) {
  const f = editFile(p);
  let old = show(base, f);
  // 比較元にまだ編集用ソースが無い場合は、比較元の公開ファイルを分解して比べる
  if (!old && p.type === "bundle") { const b = show(base, p.out); if (b) old = unbundle(b).page; }
  const before = extractTexts(old);
  const after = extractTexts(fs.readFileSync(path.join(ROOT, f), "utf8"));
  const changes = diffTexts(before, after);
  if (!changes.length) continue;
  total += changes.length;
  md += `### ${p.name}（${p.url}）\n\n| 種類 | 修正前 | 修正後 | 場所（直前の文） |\n|---|---|---|---|\n`;
  for (const c of changes) md += `| ${c.kind} | ${cell(c.before)} | ${cell(c.after)} | ${cell(c.prev)} |\n`;
  md += "\n";
}
if (!total) md += "画面に出る文言・リンクの変更はありません（見た目・仕組みのみの変更）。\n";
md += "\n---\n承認する場合は、プレビューで見た目を確認してから **Merge** を押してください。数分で本番に反映されます。\n";
process.stdout.write(md);
