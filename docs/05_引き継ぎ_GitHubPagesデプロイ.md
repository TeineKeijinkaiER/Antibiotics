# 引き継ぎ資料：GitHub Pages デプロイ自動化（未着手）

作成日: 2026-08-27
作業ブランチ: `claude/antibiotic-app-planning-b4e13g`

## やりたいこと

GitHub Pages からすぐ使えるようにする。リポジトリ名が `Antibiotics` のため、
公開URLはユーザーページではなくプロジェクトページ、つまり
`https://<user>.github.io/Antibiotics/` というサブパス配信になる。
このサブパスで Service Worker・PWAアイコン・manifest が壊れないようにした上で、
push だけで自動デプロイされる状態を作る。

## 現状（このセッションで確認済み。コードは未変更）

サブパス対応の下地はすでにできている。**新規に手を入れる必要があるのは
デプロイの自動化（GitHub Actions ワークフロー）だけ**という認識。

- `vite.config.ts` は `base: "./"`（相対パス）になっている → サブパスでもアセット解決は壊れない
- `public/manifest.webmanifest` の `start_url` / `scope` / `icons[].src` はすべて `./` 相対 → OK
- `index.html` の `<link rel="manifest">` `<link rel="apple-touch-icon">` も `./` 相対 → OK
  - ただし `<script type="module" src="/src/main.tsx">` は絶対パスだが、これは Vite が
    ビルド時に `dist/index.html` 内で相対パスへ書き換える（Vite の通常の挙動）ので問題ない。
    ビルド後の `dist/index.html` で `src="./assets/....js"` になっていることは未確認 → **要確認**
- `src/lib/sw.ts` の SW登録は `document.baseURI` を基準に `sw.js` の URL とスコープを解決している
  → デプロイ先のパスがどこであっても正しく動く設計（相対base URLに依存しないので堅牢）
- `scripts/make-sw.mjs` は `dist/` を再帰的に walk して `./` 相対パスで precache リストを作る
  → サブパス配信でも問題ない
- **`.github/workflows/` ディレクトリ自体が存在しない**（`ls -la .github/workflows/` で確認済み、
  何もヒットしなかった）→ デプロイワークフローはゼロから作る必要がある

## 次にやること（このセッションの続きとして）

1. `dist/index.html` を実際に一度ビルドして中身を確認し、`base: "./"` が
   GitHub Pages のプロジェクトページ配信（`/Antibiotics/xxx`）で問題ないか実地検証する。
   - `npm run build` → `dist/index.html` の `<script>` タグと `<link>` タグの相対パスを確認
   - 可能なら `npx serve dist` 等で `/Antibiotics/` 相当のサブパスを模して手元確認するとより確実
2. `.github/workflows/deploy.yml` を新規作成する。方針案:
   - トリガー: `push` to `main`（または現在のデフォルトブランチ。要確認 — このリポジトリの
     デフォルトブランチ名をまだ見ていない）
   - `actions/setup-node` → `npm ci` → `npm run build`（validate → typecheck → vite build →
     make-sw.mjs の順で既に package.json に定義済み）
   - `actions/upload-pages-artifact` で `dist/` をアップロード
   - `actions/deploy-pages` でデプロイ
   - 公式の Actions ベース Pages デプロイ（`actions/configure-pages` 等）を使う想定。
     `gh-pages` ブランチ運用ではなく Pages の「GitHub Actions」ソースを使う方針。
3. GitHub 側リポジトリ設定で Pages のソースを「GitHub Actions」に切り替える必要がある
   （これはリポジトリ管理者の操作。ユーザーに依頼するか、権限があれば
   `mcp__github__` 系ツールで確認できるか調べる）。
4. `vite.config.ts` の `base` は `"./"` のままで大丈夫なはずだが、Pages
   プロジェクトページのURL構造 (`/Antibiotics/`) に対して `base: "/Antibiotics/"`
   に明示した方が事故が少ないという考え方もある。相対パス方式 vs 絶対base方式は
   どちらでも動くはずだが、実ビルドでの確認前にどちらか決め打ちしない。
5. README に「GitHub Pages で公開する」手順・公開URLを追記する（現状 README には
   デプロイ手順の記載なし）。

## 未確認・要判断事項

- デフォルトブランチ名（`main` か `master` か）を未確認。ワークフローのトリガーに関わる。
- リポジトリの Pages 設定が現状どうなっているか（有効化されているか、ソースは何か）未確認。
- 院内利用前提のアプリ（患者データは扱わないが院内マニュアル準拠）を GitHub Pages で
  一般公開してよいかは、ユーザー側の判断事項として確認した方がよいかもしれない
  （このセッションでは指摘のみ、判断はユーザーに委ねる）。

## 参考：この直前まで実施していた作業

Phase 0〜2 実装、アンチバイオグラム原本照合（2026-08-26 完了）まで完了しており、
機能面はコミット済みで安定している（`git log` 参照）。今回の GitHub Pages 対応は
純粋にデプロイ・配信まわりのタスクで、アプリのデータ/機能には影響しない。
