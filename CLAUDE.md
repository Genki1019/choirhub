@AGENTS.md

# ChoirHub — プロジェクトガイド

## プロダクト概要

合唱団運営に関わる全業務（スケジュール・楽譜・出欠・本番・チケット・メーリス）をひとつのSaaSで完結させるマルチテナントWebアプリ。

**ターゲット**: 男声合唱団（将来: 混声・女声・学生合唱に展開）

## テクノロジースタック

### フロントエンド（`apps/web`）

- **Next.js 16 (App Router)** + TypeScript 5
- **Tailwind CSS v4** + shadcn/ui（Radixベース、`cssVariables: false`。生成物は`components/ui/`）
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
- Upstash Redis（レートリミット）
- ical-generator（スケジュールのiCalフィード配信）

### インフラ

- Vercel（フロントエンド + API、2プロジェクト）/ Neon（PostgreSQL）
- pnpm workspaces（モノレポ管理）

## アーキテクチャ

### マルチテナント設計

- URLパターン: `/:orgSlug/...`（テナント識別子をパスに含める）
- 全DBクエリに `orgId` を必ず付与（テナント間データ漏えい防止）
- `authMiddleware` がセッションから `user` を、`tenantMiddleware` が `orgSlug` から `org`・`member` を解決し、`c.set()` でコンテキストに格納する（ハンドラは `c.get("member")` で参照）

### 権限ロール

ロールは階層値を持ち、`hasRole()`（`apps/api/src/services/access.ts`）は「必要ロール以上の階層値を持つか」で判定する。同一階層のロールは相互に通過する（例: `tech`を要求するチェックは`conductor`/`score`でも通過する）。ただし、オンステ調査・フォーメーション・予定の管理は`isTechOrConductor()`（admin・tech・conductor。`score`は含まない）で判定する。

| ロール       | 英名        | 階層値 | 主な権限                                              |
| ------------ | ----------- | -----: | ----------------------------------------------------- |
| 最高管理者   | `admin`     |    100 | 全権限                                                |
| 技術系       | `tech`      |     60 | 選曲・スケジュール・ステージ構成                      |
| 指揮者       | `conductor` |     60 | `tech`と同階層                                        |
| 楽譜がかり   | `score`     |     60 | 楽譜管理・アップロード                                |
| チケット担当 | `ticket`    |     40 | チケット配布・集計                                    |
| 会計         | `finance`   |     40 | 支出管理・団員支払い記録                              |
| 一般         | `member`    |     40 | 閲覧・出欠回答                                        |
| 客演         | `guest`     |     20 | スケジュール・楽譜閲覧・出欠                          |
| 体験         | `visitor`   |     10 | 共有アカウント。全楽譜の全体譜PDFのみブラウザで閲覧可 |

- 複数ロール付与可（`roles: string[]`）。上記いずれの英名も`roles`配列に含める形で付与する

### データ階層

```text
Organization → Member / Part / Event / Score / Concert / StoredFile / Expense / Collection / MailLog / Notification / AuditLog
Event → Attendance → Member
Score → ScoreFile / ScorePurchase
Concert → Stage → Program → Score
Concert → OnStageAssignment / ConcertSurvey
Stage → FormationPattern
StoredFile → OrgDocument / ScoreFile / ConcertFile / EventFile
Concert → TicketBatch → TicketAllocation → Member
```

全テーブル・カラムは `docs/database.md` を参照。

## ディレクトリ構成

```text
choirhub/
├── apps/
│   ├── web/                  # Next.js（App Router）
│   │   ├── app/
│   │   │   ├── (auth)/       # ログイン・招待・パスワードリセット・メール変更・団体選択
│   │   │   ├── (info)/       # 問い合わせ・利用規約・プライバシーポリシー
│   │   │   ├── apply/        # 団体作成の申請フォーム
│   │   │   ├── admin/        # システム管理者コンソール（[org]配下とは独立）
│   │   │   ├── api/          # Route Handlers
│   │   │   └── [org]/        # テナント別ルート（機能ごとのディレクトリ + 画面専用の _components/）
│   │   ├── components/       # 画面横断の共通コンポーネント（ui/ は shadcn/ui の生成物）
│   │   ├── hooks/ / contexts/ / lib/
│   │   └── proxy.ts
│   └── api/src/              # Hono
│       ├── routes/           # ルートハンドラ（リソース単位）
│       ├── middleware/       # 認証・テナント解決・システム管理者判定
│       ├── services/         # 業務ロジック・外部連携（権限判定は access.ts）
│       ├── lib/              # 汎用処理（Prisma・セッション・Redis・CSV・日付等）
│       └── generated/        # Prisma Client（自動生成）
└── docs/                     # 要件定義・DB・API・画面設計
```

## コーディング規則

- **型**: `any` 禁止。API境界はZodで検証し型を推論する
- **Prisma**: クエリには必ず `where: { orgId }` を含める（マルチテナント漏えい防止）
- **日付・時刻**: 表示や「何日か」の判定は日本時間で行う。web は `lib/date.ts` のヘルパー（`jstParts`・`formatJaDate`・`formatShortDate`・`todayStr` 等）を使い、`getFullYear()`・`toLocaleDateString()` などブラウザのタイムゾーンに依存する書き方はしない（ESLint で禁止）。API は時刻付きの日時を `toJstDateString`、日付だけの列（`@db.Date`）を `toDateString` で切り出し、「今日」や日付での絞り込みは `jstDayStart`・`jstDayEnd` で日本時間の区切りにする（サーバーは UTC で動くため。`setHours()` などは ESLint で禁止、`toLocaleString()` 等には `timeZone: "Asia/Tokyo"` を指定する）
- **ファイルDL**: S3/R2直リンク禁止。必ずPresigned URLを発行する（例外: アバター画像は非機密情報のため`R2_PUBLIC_URL`設定時にCDN直リンクを許容）
- **権限チェック**: ロール判定は `services/access.ts` のヘルパー（`isAdmin`・`hasRole` 等）で行い、ロール文字列の直接比較や判定ロジックの重複をしない
- **楽譜アクセス**: visitor（共有）→ access_level 問わず全楽譜の全体譜PDF（`full_score`）のみ閲覧可（パート譜・MIDI・音源・その他は不可）; 一般団員 → 購入記録があるもののみDL可（public含む）; secret → 特権ユーザー（admin/score/tech/conductor）のみ（visitor は例外として secret PDF も閲覧可）
- **コンポーネント再利用**: 既存の共通コンポーネント（`apps/web/components/`）を優先し、画面ごとの重複実装を避ける。モーダルは`Modal`、エラー表示は`ErrorMessage`を使い、`fixed inset-0`の手書きモーダルや`bg-red-50`の手書きエラーを新たに作らない
- **テスト**: 新規・変更したモジュール（routes・services・lib・middleware・コンポーネント・ページ・hooks）には、同階層の`__tests__/`にテストを追加する

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
