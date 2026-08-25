@AGENTS.md

# ChoirHub — プロジェクトガイド

## プロダクト概要

合唱団運営に関わる全業務（スケジュール・楽譜・出欠・本番・チケット・メーリス）をひとつのSaaSで完結させるマルチテナントWebアプリ。

**ターゲット**: 男声合唱団（将来: 混声・女声・学生合唱に展開）

## テクノロジースタック

### フロントエンド（`apps/web`）

- **Next.js 16 (App Router)** + TypeScript 5
- **Tailwind CSS v4**（shadcn/ui未導入。共通コンポーネント基盤として導入予定）
- lucide-react（アイコン）
- TanStack Query v5（サーバーステート）/ React Context・`useState`（クライアントステート）
- React Hook Form + Zod（フォーム・バリデーション）
- @dnd-kit（本番・オンステ管理のドラッグ&ドロップ）

### バックエンド（`apps/api`）

- **Hono**（軽量APIフレームワーク）+ TypeScript
- **Prisma** ORM + PostgreSQL 16
- 自前セッション管理（`lib/session.ts`、Prisma `Session`テーブル + Cookie）+ argon2（パスワードハッシュ）
- Cloudflare R2（ファイルストレージ・S3互換、`@aws-sdk/client-s3`経由）
- Resend（メール送信）
- Upstash Redis（セッション・レートリミット）
- ical-generator（スケジュールのiCalフィード配信）

### インフラ

- Vercel（フロントエンド + API、2プロジェクト）/ Neon（PostgreSQL）
- pnpm workspaces（モノレポ管理）

## アーキテクチャ

### マルチテナント設計

- URLパターン: `/:orgSlug/...`（テナント識別子をパスに含める）
- 全DBクエリに `orgId` を必ず付与（テナント間データ漏えい防止）
- 認証ミドルウェアが `orgSlug → orgId` を解決し `req.member` にセット

### 権限ロール

ロールは階層値を持ち、`hasRole()`（`apps/api/src/services/access.ts`）は「必要ロール以上の階層値を持つか」で判定する。同一階層のロールは相互に通過する（例: `tech`を要求するチェックは`conductor`/`score`でも通過する）。

| ロール       | 英名        | 階層値 | 主な権限                                                |
| ------------ | ----------- | -----: | ------------------------------------------------------- |
| 最高管理者   | `admin`     |    100 | 全権限                                                  |
| 技術系       | `tech`      |     60 | 選曲・スケジュール・ステージ構成                        |
| 指揮者       | `conductor` |     60 | `tech`と同階層                                          |
| 楽譜がかり   | `score`     |     60 | 楽譜管理・アップロード                                  |
| チケット担当 | `ticket`    |     40 | チケット配布・集計                                      |
| 会計係       | `finance`   |     40 | 支出管理・団員支払い記録                                |
| 一般         | `member`    |     40 | 閲覧・出欠回答                                          |
| 客演         | `guest`     |     20 | スケジュール・楽譜閲覧・出欠                            |
| 体験         | `visitor`   |     10 | 共有アカウント。全楽譜PDFをブラウザで閲覧可（MIDI不可） |

- 複数ロール付与可（`roles: string[]`）。上記いずれの英名も`roles`配列に含める形で付与する

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
│   │   ├── (auth)/password-reset/
│   │   ├── (auth)/select-org/
│   │   ├── apply/            # 団体作成の申請フォーム
│   │   ├── admin/            # システム管理者コンソール（[org]配下とは独立）
│   │   └── [org]/           # テナント別ルート（layout.tsx で orgId 解決）
│   │       ├── page.tsx     # ホーム
│   │       ├── members/
│   │       ├── schedule/
│   │       ├── scores/
│   │       ├── concerts/
│   │       ├── mailing/
│   │       ├── tickets/
│   │       ├── accounting/
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
- **ファイルDL**: S3/R2直リンク禁止。必ずPresigned URLを発行する（例外: アバター画像は非機密情報のため`R2_PUBLIC_URL`設定時にCDN直リンクを許容）
- **権限チェック**: ミドルウェアで完結させ、各ルートハンドラでロール確認を重複させない
- **楽譜アクセス**: visitor（共有）→ access_level 問わず全楽譜PDF閲覧可（MIDI不可）; 一般団員 → 購入記録があるもののみDL可（public含む）; secret → 特権ユーザー（admin/score/tech/conductor）のみ（visitor は例外として secret PDF も閲覧可）
- **コンポーネント再利用**: 既存の共通コンポーネント（`apps/web/components/`）を優先し、画面ごとの重複実装（モーダル・エラー表示等）を避ける
- **テスト**: 新規・変更したAPIエンドポイントには`apps/api/src/routes/__tests__/`に、フロントエンドの新規・変更コンポーネントには同階層の`__tests__/`にテストを追加する

## コミット・PR運用

- **メッセージ**: `feat:` / `fix:` / `docs:` / `chore:` 等 + 体言止めの1行のみ。本文・scope括弧（`feat(api):`等）は付けない
- **粒度**: 1ファイル=1コミットにせず、機能的にまとまった単位（同系統のモーダル群、一覧＋子コンポーネント群等）でコミットする
- **PRタイトル**: コミットメッセージと同じ体言止めルール。Squash merge運用のため、ブランチ内の各コミット件名がそのままマージコミット本文に残る

## ドキュメント管理ルール

### 仕様変更時のドキュメント同期

実装中に仕様変更が生じた場合は、コードと合わせて `docs/` 配下の該当ドキュメントを必ず同時に修正すること。

| 変更の性質                                  | 更新対象               |
| ------------------------------------------- | ---------------------- |
| 機能要件・権限・スコープの変更              | `docs/requirements.md` |
| テーブル・カラム・リレーションの変更        | `docs/database.md`     |
| エンドポイント・リクエスト/レスポンスの変更 | `docs/api.md`          |
| 画面構成・レイアウト・遷移の変更            | `docs/screens.md`      |

複数ドキュメントにまたがる変更の場合はすべて更新する。docsの更新は、実装・テストと合わせて**作業の最後のコミット**として行う（実装だけ終えて「あとで直す」という進め方はしない）。

### 仕様の矛盾・不明点の扱い

実装中に仕様の矛盾や曖昧な点を発見した場合は、**独断で解決せず**以下を行うこと。

1. 矛盾・不明点の内容を明示する
2. 矛盾が生じている箇所（ドキュメント名・セクション）を示す
3. 考えられる解釈の選択肢を提示する
4. ユーザーに確認を求めてから実装を進める

## 実装フェーズ（MVP: 約12週、実績）

| フェーズ | 内容                                          |
| -------- | --------------------------------------------- |
| Week 1-2 | モノレポ・CI/CD・DB・認証・マルチテナント基盤 |
| Week 3   | メンバー管理（CRUD・招待・顔写真）            |
| Week 4-5 | スケジュール + 出欠（伝助ビュー）             |
| Week 6-7 | 楽譜・MIDI管理（アップロード・権限・価格）    |
| Week 8-9 | 本番・オンステ管理                            |
| Week 10  | メーリス                                      |
| Week 11  | チケット管理・パートレース                    |
| Week 12  | ホーム・UI仕上げ・デプロイ                    |
