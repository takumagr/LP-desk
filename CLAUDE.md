# LP-desk 編集ルール（LP CMS）

このリポジトリは for Crafts の LP です。main ブランチ = 本番（Vercel が自動で公開）。
編集は **岩本さんの依頼 → Claude が修正PR → プレビュー確認 → 岩本さんが Merge（＝承認）→ 本番反映** の流れだけで行う。

## 絶対に守ること
- main に直接 push しない。Merge もしない（Merge は岩本さんの承認行為）
- 依頼された箇所以外は変えない。文言の言い換えを勝手に足さない
- 1つの依頼 = 1つのPR。ブランチ名は `edit/YYYYMMDD-内容`（例 `edit/20261125-hero-copy`）

## ページと編集するファイル
対応表は `cms.config.json`。

| ページ | URL | 編集するファイル | 公開ファイル |
|---|---|---|---|
| DESK ウェイトリスト | / | `src/index/page.html` | `index.html`（自動生成・直接編集しない） |
| 風土承継機構 | /next | `next/index.html` | 同じ |

- `index.html` は Claude Design の書き出し形式（1ファイルに画像・フォントを埋め込み）。人もAIも直接触らず、`src/index/page.html` を直して `node scripts/build.mjs` で組み立てる
- DESK の切替文言（日本語/英語）は `page.html` 末尾の `const T = { ja: {...}, en: {...} }` にある。片方だけ直したら、もう片方も直すか岩本さんに確認する
- 画像・フォントは `src/index/assets.json`（触らない）

## 手順
1. `git checkout -b edit/YYYYMMDD-内容`
2. 対象ファイルを修正
3. `node scripts/build.mjs`（DESK を触ったとき）
4. `node scripts/check.mjs` が「検査OK」になるまで直す
5. 表示確認：ローカルで `python3 -m http.server` を立て、幅390px（スマホ）と1280pxでスクリーンショットを撮り、崩れ・はみ出しがないか目視（DESK は表示に unpkg.com の React を使う。作業環境で unpkg が遮断される場合は npm で同じ版を入れ、ブラウザ側でそのURLを差し替えて表示する）
6. `node scripts/textdiff.mjs origin/main` の出力を PR 本文の先頭に貼る
7. push → PR作成（下のテンプレート）
8. Vercel のプレビューURLを取得して PR とチャットで岩本さんに渡す
   `gh api repos/takumagr/lp-desk/deployments?ref=<ブランチ名>` → 最新の statuses の `environment_url`

## PR本文テンプレート
```
<textdiff の出力>

### 依頼内容
（岩本さんの依頼を1行で）

### 確認してほしいこと
- プレビュー: <URL>
- （判断が要る点があれば選択肢と推奨案）
```

## Claude Design で作り直したLPを取り込むとき
`node scripts/unbundle.mjs <書き出したHTML> src/<名前>` で分解し、`cms.config.json` に追記する。
分解→再結合が元ファイルとバイト一致しないと止まる（安全装置）。
