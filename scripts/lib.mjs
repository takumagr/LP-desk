// LP CMS 共通処理（外部ライブラリなし / Node 18+）
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const config = JSON.parse(fs.readFileSync(path.join(ROOT, "cms.config.json"), "utf8"));

const TEMPLATE_RE = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
const MANIFEST_RE = /(<script type="__bundler\/manifest">)([\s\S]*?)(<\/script>)/;
const TEMPLATE_MARK = "<!--CMS:TEMPLATE-->";
const MANIFEST_MARK = "<!--CMS:MANIFEST-->";

// ---------- Claude Design の書き出し(1ファイル) ⇄ 編集用ソース ----------

/** 書き出しHTMLを { shell, page, assets } に分解する */
export function unbundle(bundleHtml) {
  const t = bundleHtml.match(TEMPLATE_RE);
  const m = bundleHtml.match(MANIFEST_RE);
  if (!t || !m) throw new Error("Claude Design の書き出しファイルではありません（__bundler の script が見つかりません）");
  const lead = t[2].match(/^\s*/)[0];
  const trail = t[2].match(/\s*$/)[0];
  const page = JSON.parse(t[2]);
  const shell = bundleHtml
    .replace(TEMPLATE_RE, (_, a, _b, c) => a + lead + TEMPLATE_MARK + trail + c)
    .replace(MANIFEST_RE, (_, a, _b, c) => a + MANIFEST_MARK + c);
  return { shell, page, assets: m[2] };
}

/** 編集用ソースから書き出しHTMLを組み立てる（元の書き出しとバイト一致する形式） */
export function bundle({ shell, page, assets }) {
  const encoded = JSON.stringify(page).replace(/<\//g, "<\\u002F");
  return shell
    .split(MANIFEST_MARK).join(assets)
    .split(TEMPLATE_MARK).join(encoded);
}

export function readBundleSrc(dir) {
  return {
    shell: fs.readFileSync(path.join(dir, "shell.html"), "utf8"),
    page: fs.readFileSync(path.join(dir, "page.html"), "utf8"),
    assets: fs.readFileSync(path.join(dir, "assets.json"), "utf8"),
  };
}

export function writeBundleSrc(dir, { shell, page, assets }) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "shell.html"), shell);
  fs.writeFileSync(path.join(dir, "page.html"), page);
  fs.writeFileSync(path.join(dir, "assets.json"), assets);
}

/** ページの「編集する本体」ファイル（差分比較の対象） */
export function editFile(p) {
  return p.type === "bundle" ? path.join(p.src, "page.html") : p.file;
}

// ---------- 画面に出る文言の抜き出し（変更点の比較用） ----------

const decode = (s) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** HTML から、画面に出る文言・リンク先・画像の代替テキスト等を順番どおりに取り出す */
export function extractTexts(html) {
  const out = [];
  let body = html;
  // x-dc ロジック内の文言（JS の文字列リテラル）
  const xdc = [...html.matchAll(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/g)];
  body = body.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
             .replace(/<!--[\s\S]*?-->/g, " ")
             .replace(/<head[\s>][\s\S]*?<\/head>/i, " ").replace(/<!doctype[^>]*>/i, " ");
  const title = html.match(/<title>([\s\S]*?)<\/title>/);
  if (title) out.push({ kind: "タイトル", text: decode(title[1].trim()) });
  for (const m of html.matchAll(/<meta[^>]+name="description"[^>]+content="([^"]*)"/g))
    out.push({ kind: "説明文(meta)", text: decode(m[1]) });
  // タグと文言を順に走査
  for (const m of body.matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g)) {
    if (m[3] !== undefined) {
      const t = decode(m[3]).replace(/\s+/g, " ").trim();
      if (t && !/^\{\{.*\}\}$/.test(t)) out.push({ kind: "文言", text: t });
      continue;
    }
    const attrs = m[2] || "";
    for (const [attr, kind] of [["href", "リンク先"], ["alt", "画像の説明"], ["placeholder", "入力欄の案内"], ["aria-label", "読み上げ名"]]) {
      const a = attrs.match(new RegExp(`\\s${attr}="([^"]*)"`));
      if (a && a[1] && a[1] !== "#" && !a[1].startsWith("{{")) out.push({ kind, text: decode(a[1]) });
    }
  }
  for (const s of xdc) {
    for (const lit of s[1].matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
      const t = lit[1];
      // 色コード・正規表現・短い識別子は除外し、人が読む文言だけ残す
      if (/[ぁ-んァ-ヶ一-龠]/.test(t) || (/\s/.test(t) && /[A-Za-z]{2,}/.test(t) && !/^#|^\d/.test(t)))
        out.push({ kind: "文言(切替表示)", text: JSON.parse(`"${t}"`) });
    }
  }
  return out;
}

// ---------- 差分（LCS） ----------

export function diffTexts(before, after) {
  const a = before.map((x) => x.kind + "\u0000" + x.text);
  const b = after.map((x) => x.kind + "\u0000" + x.text);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { ops.push({ op: "same", item: before[i] }); i++; j++; }
    else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) { ops.push({ op: "add", item: after[j] }); j++; }
    else { ops.push({ op: "del", item: before[i] }); i++; }
  }
  // 連続する 削除→追加 を「修正」としてまとめる
  const changes = [];
  let lastSame = null;
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].op === "same") { lastSame = ops[k].item.text; continue; }
    const dels = [], adds = [];
    while (k < ops.length && ops[k].op !== "same") {
      (ops[k].op === "del" ? dels : adds).push(ops[k].item);
      k++;
    }
    const next = k < ops.length ? ops[k].item.text : null;
    const len = Math.max(dels.length, adds.length);
    for (let x = 0; x < len; x++)
      changes.push({ kind: (adds[x] || dels[x]).kind, before: dels[x]?.text ?? null, after: adds[x]?.text ?? null, prev: lastSame, next });
    k--;
  }
  return changes;
}
