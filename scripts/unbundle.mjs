// Claude Design から書き出した1ファイルHTMLを、編集用ソースに分解する
// 使い方: node scripts/unbundle.mjs <書き出しHTML> <出力フォルダ 例: src/index>
import fs from "node:fs";
import path from "node:path";
import { unbundle, bundle, writeBundleSrc, ROOT } from "./lib.mjs";

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("使い方: node scripts/unbundle.mjs <書き出しHTML> <出力フォルダ>");
  process.exit(1);
}
const html = fs.readFileSync(input, "utf8");
const src = unbundle(html);
if (bundle(src) !== html) throw new Error("分解→再結合で元のファイルと一致しません。中止しました。");
writeBundleSrc(path.resolve(ROOT, outDir), src);
console.log(`分解しました → ${outDir}/page.html を編集してください（再結合: node scripts/build.mjs）`);
