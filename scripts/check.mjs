// 公開前の検査。1つでも失敗すると終了コード1（PRのチェックが赤になる）
// 使い方: node scripts/check.mjs
import fs from "node:fs";
import path from "node:path";
import { config, bundle, readBundleSrc, extractTexts, editFile, ROOT } from "./lib.mjs";

const errors = [];
for (const p of config.pages) {
  const file = path.join(ROOT, editFile(p));
  const html = fs.readFileSync(file, "utf8");

  if (p.type === "bundle") {
    const built = bundle(readBundleSrc(path.join(ROOT, p.src)));
    const current = fs.readFileSync(path.join(ROOT, p.out), "utf8");
    if (built !== current) errors.push(`${p.name}: ${p.out} が ${p.src}/page.html と食い違っています。node scripts/build.mjs を実行してください`);
    // x-dc の {{ 名前 }} が、ロジック側に存在するか
    const logic = (html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || "";
    for (const m of new Set([...html.matchAll(/\{\{\s*([\w$]+)\s*\}\}/g)].map((m) => m[1])))
      if (!new RegExp(`\\b${m}\\b`).test(logic)) errors.push(`${p.name}: 表示用の名前 {{ ${m} }} がロジックにありません`);
    // 日本語版と英語版で項目がそろっているか
    const ja = logic.match(/ja:\s*\{([\s\S]*?)\n\s*\},/), en = logic.match(/en:\s*\{([\s\S]*?)\n\s*\},/);
    if (ja && en) {
      const keys = (s) => new Set([...s.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]));
      const kj = keys(ja[1]), ke = keys(en[1]);
      for (const k of kj) if (!ke.has(k)) errors.push(`${p.name}: 英語版に「${k}」がありません`);
      for (const k of ke) if (!kj.has(k)) errors.push(`${p.name}: 日本語版に「${k}」がありません`);
    }
  }

  // 空のリンク・仮の文言が残っていないか
  for (const t of extractTexts(html)) {
    if (/TODO|ダミー|lorem ipsum|XXX/i.test(t.text)) errors.push(`${p.name}: 仮の文言が残っています「${t.text.slice(0, 40)}」`);
    if (t.kind === "リンク先" && /^(javascript:|https?:\/\/(localhost|127\.))/.test(t.text)) errors.push(`${p.name}: 公開できないリンク先 ${t.text}`);
  }
  if (!/<\/html>/i.test(html)) errors.push(`${p.name}: </html> がありません（途中で切れている可能性）`);
}

if (errors.length) {
  console.error("検査NG:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`検査OK（${config.pages.length}ページ）`);
