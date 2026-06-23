@AGENTS.md

# ChoirHub — プロジェクトガイド

## プロダクト概要

合唱団運営に関わる全業務（スケジュール・楽譜・出欠・本番・チケット・メーリス）をひとつのSaaSで完結させるマルチテナントWebアプリ。

**ターゲット**: 男声合唱団（将来: 混声・女声・学生合唱に展開）

## テクノロジースタック

### フロントエンド（`apps/web`）

- **Next.js 16 (App Router)** + TypeScript 5
- **Tailwind CSS v4** + shadcn/ui（Radixベース）
- TanStack Query v5（サーバーステート）/ Zustand（クライアントステート）
- React Hook Form + Zod（フォーム・バリデーション）
- TanStack Table v8（出欠表・メンバー一覧）

### バックエンド（`apps/api`）

- **Hono**（軽量APIフレームワーク）+ TypeScript
- **Prisma** ORM + PostgreSQL 16
- Lucia v3（認証・セッション管理）
- Cloudflare R2（ファイルストレージ・S3互換）
- Resend（メール送信）
- Upstash Redis（セッション・レートリミット）

### インフラ

- Vercel（フロントエンド + API、2プロジェクト）/ Neon（PostgreSQL）
- pnpm workspaces（モノレポ管理）

## アーキテクチャ

### マルチテナント設計

- URLパターン: `/:orgSlug/...`（テナント識別子をパスに含める）
- 全DBクエリに `orgId` を必ず付与（テナント間データ漏えい防止）
- 認証ミドルウェアが `orgSlug → orgId` を解決し `req.member` にセット

### 権限ロール

| ロール | 英名 | 主な権限 |
|--------|------|---------|
| 最高管理者 | `admin` | 全権限 |
| 技術系 | `tech` | 選曲・スケジュール・ステージ構成 |
| 楽譜がかり | `score` | 楽譜管理・アップロード |
| 一般 | `member` | 閲覧・出欠回答 |
| 客演 | `guest` | スケジュール・楽譜閲覧・出欠 |
| 体験 | `visitor` | 共有アカウント。全楽譜PDFをブラウザで閲覧可（MIDI不可）|

- 複数ロール付与可（`roles: string[]`）
- 指揮者: `roles` 配列に `"conductor"` を含める
- チケット担当: `roles` 配列に `"ticket"` を含める
- 会計担当: `roles` 配列に `"finance"` を含める

### データ階層

```text
Organization → Member / Part / Event / Score / Concert / MailLog
Concert → Stage → Program → Score
Concert → TicketBatch → TicketAllocation → Member
```

## ディレクトリ構成

```text
choirhub/
├── apps/
│   ├── web/app/
│   │   ├── (auth)/login/
│   │   ├── (auth)/invite/[token]/
│   │   └── [org]/           # テナント別ルート（layout.tsx で orgId 解決）
│   │       ├── page.tsx     # ホーム
│   │       ├── members/
│   │       ├── schedule/
│   │       ├── scores/
│   │       ├── concerts/
│   │       ├── mailing/
│   │       ├── tickets/
│   │       └── settings/
│   └── api/src/
│       ├── routes/          # Honoルートハンドラ
│       ├── middleware/      # auth.ts / tenant.ts
│       ├── services/        # storage.ts / mail.ts / access.ts
│       └── lib/prisma.ts
```

## コーディング規則

- **型**: `any` 禁止。API境界はZodで検証し型を推論する
- **Prisma**: クエリには必ず `where: { orgId }` を含める（マルチテナント漏えい防止）
- **ファイルDL**: S3/R2直リンク禁止。必ずPresigned URLを発行する
- **権限チェック**: ミドルウェアで完結させ、各ルートハンドラでロール確認を重複させない
- **楽譜アクセス**: visitor（共有）→ access_level 問わず全楽譜PDF閲覧可（MIDI不可）; 一般団員 → 購入記録があるもののみDL可（public含む）; secret → 特権ユーザー（admin/score/tech/conductor）のみ（visitor は例外として secret PDF も閲覧可）

## ドキュメント管理ルール

### 仕様変更時のドキュメント同期

実装中に仕様変更が生じた場合は、コードと合わせて `docs/` 配下の該当ドキュメントを必ず同時に修正すること。

| 変更の性質 | 更新対象 |
|-----------|---------|
| 機能要件・権限・スコープの変更 | `docs/requirements.md` |
| テーブル・カラム・リレーションの変更 | `docs/database.md` |
| エンドポイント・リクエスト/レスポンスの変更 | `docs/api.md` |
| 画面構成・レイアウト・遷移の変更 | `docs/screens.md` |

複数ドキュメントにまたがる変更の場合はすべて更新する。

### 仕様の矛盾・不明点の扱い

実装中に仕様の矛盾や曖昧な点を発見した場合は、**独断で解決せず**以下を行うこと。

1. 矛盾・不明点の内容を明示する
2. 矛盾が生じている箇所（ドキュメント名・セクション）を示す
3. 考えられる解釈の選択肢を提示する
4. ユーザーに確認を求めてから実装を進める

## 実装フェーズ（MVP: 約12週）

| フェーズ | 内容 |
|---------|------|
| Week 1-2 | モノレポ・CI/CD・DB・認証・マルチテナント基盤 |
| Week 3 | メンバー管理（CRUD・招待・顔写真）|
| Week 4-5 | スケジュール + 出欠（伝助ビュー）|
| Week 6-7 | 楽譜・MIDI管理（アップロード・権限・価格）|
| Week 8-9 | 本番・オンステ管理 |
| Week 10 | メーリス |
| Week 11 | チケット管理・パートレース |
| Week 12 | ホーム・UI仕上げ・デプロイ |
