// 編集用ソース(src/*)から公開ファイル(index.html など)を組み立てる
// 使い方: node scripts/build.mjs
import fs from "node:fs";
import path from "node:path";
import { config, bundle, readBundleSrc, ROOT } from "./lib.mjs";

for (const p of config.pages.filter((p) => p.type === "bundle")) {
  const html = bundle(readBundleSrc(path.join(ROOT, p.src)));
  fs.writeFileSync(path.join(ROOT, p.out), html);
  console.log(`組み立て完了: ${p.src}/page.html → ${p.out}`);
}
