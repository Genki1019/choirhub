# ChoirHub API設計書

**バージョン**: 1.4  
**作成日**: 2026-06-04  
**更新日**: 2026-07-14  
**ベースURL**: `/api/v1`

---

## 目次

0. [エンドポイント一覧](#エンドポイント一覧)
1. [概要・共通仕様](#1-概要共通仕様)
2. [認証 API](#2-認証-api)
3. [ホーム API](#3-ホーム-api)
4. [メンバー管理 API](#4-メンバー管理-api)
5. [スケジュール・出欠 API](#5-スケジュール出欠-api)
6. [楽譜管理 API](#6-楽譜管理-api)
7. [本番・オンステ API](#7-本番オンステ-api)
8. [メール API](#8-メール-api)
9. [チケット管理 API](#9-チケット管理-api)
10. [設定 API](#10-設定-api)
11. [会計 API](#11-会計-api)
12. [情宣活動 API](#情宣活動-outreachactivity)

---

## エンドポイント一覧

### 認証

| API名                                                      | Method | Path                           | 権限         |
| ---------------------------------------------------------- | ------ | ------------------------------ | ------------ |
| [ログイン](#auth-login)                                    | POST   | `/auth/login`                  | 公開         |
| [ログアウト](#auth-logout)                                 | POST   | `/auth/logout`                 | ログイン済み |
| [自分の認証情報取得](#auth-me)                             | GET    | `/auth/me`                     | ログイン済み |
| [招待トークン確認](#auth-invite-get)                       | GET    | `/auth/invite/:token`          | 公開         |
| [招待受諾・登録](#auth-invite-post)                        | POST   | `/auth/invite/:token`          | 公開         |
| [パスワードリセット申請](#auth-password-reset-request)     | POST   | `/auth/password-reset/request` | 公開         |
| [パスワードリセットトークン確認](#auth-password-reset-get) | GET    | `/auth/password-reset/:token`  | 公開         |
| [パスワードリセット実行](#auth-password-reset-confirm)     | POST   | `/auth/password-reset/:token`  | 公開         |
| [団体作成](#auth-orgs-create)                              | POST   | `/auth/orgs`                   | ログイン済み |

### ホーム

| API名                         | Method | Path             | 権限    |
| ----------------------------- | ------ | ---------------- | ------- |
| [ホームデータ取得](#home-get) | GET    | `/:orgSlug/home` | member+ |

### メンバー管理

| API名                                           | Method | Path                          | 権限    |
| ----------------------------------------------- | ------ | ----------------------------- | ------- |
| [メンバー一覧取得](#members-list)               | GET    | `/:orgSlug/members`           | member+ |
| [自分のプロフィール取得](#members-me-get)       | GET    | `/:orgSlug/members/me`        | member+ |
| [自分のプロフィール更新](#members-me-patch)     | PATCH  | `/:orgSlug/members/me`        | member+ |
| [アバター画像アップロード](#members-me-avatar)  | POST   | `/:orgSlug/members/me/avatar` | member+ |
| [招待メール送信](#members-invite)               | POST   | `/:orgSlug/members/invite`    | admin   |
| [メンバー詳細取得](#members-id-get)             | GET    | `/:orgSlug/members/:id`       | member+ |
| [メンバー情報更新（管理者）](#members-id-patch) | PATCH  | `/:orgSlug/members/:id`       | admin   |
| [パート一覧取得](#parts-list)                   | GET    | `/:orgSlug/parts`             | member+ |

### スケジュール・出欠

| API名                                             | Method | Path                                        | 権限    |
| ------------------------------------------------- | ------ | ------------------------------------------- | ------- |
| [イベント一覧取得](#events-list)                  | GET    | `/:orgSlug/events`                          | member+ |
| [イベント作成](#events-create)                    | POST   | `/:orgSlug/events`                          | tech+   |
| [イベント詳細・出欠一覧取得](#events-id-get)      | GET    | `/:orgSlug/events/:id`                      | member+ |
| [イベント更新](#events-id-patch)                  | PATCH  | `/:orgSlug/events/:id`                      | tech+   |
| [イベント削除](#events-id-delete)                 | DELETE | `/:orgSlug/events/:id`                      | tech+   |
| [自分の出欠更新](#attendance-me)                  | PUT    | `/:orgSlug/events/:id/attendance/me`        | member+ |
| [他メンバーの出欠更新（代理）](#attendance-proxy) | PATCH  | `/:orgSlug/events/:id/attendance/:memberId` | admin   |

### 楽譜管理

| API名                                         | Method | Path                                               | 権限         |
| --------------------------------------------- | ------ | -------------------------------------------------- | ------------ |
| [楽譜フラット一覧取得](#scores-list)          | GET    | `/:orgSlug/scores`                                 | 全ロール     |
| [楽譜グループ一覧取得](#scores-grouped)       | GET    | `/:orgSlug/scores/grouped`                         | 全ロール     |
| [楽譜新規登録](#scores-create)                | POST   | `/:orgSlug/scores`                                 | admin        |
| [楽譜詳細取得](#scores-detail)                | GET    | `/:orgSlug/scores/:scoreId`                        | 全ロール     |
| [楽譜メタデータ更新](#scores-meta-patch)      | PATCH  | `/:orgSlug/scores/:scoreId`                        | score+       |
| [配布価格設定](#scores-price)                 | PATCH  | `/:orgSlug/scores/:scoreId/price`                  | score+       |
| [購入記録取得](#scores-purchases-get)         | GET    | `/:orgSlug/scores/:scoreId/purchases`              | score+       |
| [購入記録一括保存](#scores-purchases-put)     | PUT    | `/:orgSlug/scores/:scoreId/purchases`              | score+       |
| [プレサインドURL発行](#scores-file-presign)   | POST   | `/:orgSlug/scores/:scoreId/files/presign`          | score+/tech+ |
| [アップロード確定](#scores-file-confirm)      | POST   | `/:orgSlug/scores/:scoreId/files/confirm`          | score+/tech+ |
| [ファイルアップロード](#scores-file-upload)   | POST   | `/:orgSlug/scores/:scoreId/files`                  | score+/tech+ |
| [ファイルダウンロード](#scores-file-download) | GET    | `/:orgSlug/scores/:scoreId/files/:fileId/download` | 権限別       |
| [ファイル削除](#scores-file-delete)           | DELETE | `/:orgSlug/scores/:scoreId/files/:fileId`          | score+/tech+ |

### 本番・オンステ

| API名                                                         | Method | Path                                                                                | 権限     |
| ------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- | -------- |
| [演奏会一覧取得](#concerts-list)                              | GET    | `/:orgSlug/concerts`                                                                | member+  |
| [演奏会作成](#concerts-create)                                | POST   | `/:orgSlug/concerts`                                                                | admin    |
| [演奏会+ステージ軽量一覧取得](#concerts-structure)            | GET    | `/:orgSlug/concerts/structure`                                                      | 全ロール |
| [演奏会詳細取得](#concerts-id-get)                            | GET    | `/:orgSlug/concerts/:id`                                                            | member+  |
| [演奏会情報更新](#concerts-id-patch)                          | PATCH  | `/:orgSlug/concerts/:id`                                                            | admin    |
| [演奏会削除](#concerts-id-delete)                             | DELETE | `/:orgSlug/concerts/:id`                                                            | admin    |
| [ステージ追加](#stage-create)                                 | POST   | `/:orgSlug/concerts/:concertId/stages`                                              | admin    |
| [ステージ名更新](#stage-patch)                                | PATCH  | `/:orgSlug/concerts/:concertId/stages/:stageId`                                     | admin    |
| [ステージ並び替え](#stages-order)                             | PUT    | `/:orgSlug/concerts/:concertId/stages/order`                                        | admin    |
| [演目追加](#program-create)                                   | POST   | `/:orgSlug/concerts/:concertId/stages/:stageId/programs`                            | admin    |
| [演目並び替え](#programs-order)                               | PUT    | `/:orgSlug/concerts/:concertId/stages/:stageId/programs/order`                      | admin    |
| [演目削除](#program-delete)                                   | DELETE | `/:orgSlug/concerts/:concertId/programs/:programId`                                 | admin    |
| [演目編集](#program-patch)                                    | PATCH  | `/:orgSlug/concerts/:concertId/programs/:programId`                                 | admin    |
| [調査作成（複数回対応）](#surveys-create)                     | POST   | `/:orgSlug/concerts/:concertId/surveys`                                             | tech+    |
| [調査詳細取得](#surveys-id-get)                               | GET    | `/:orgSlug/concerts/:concertId/surveys/:surveyId`                                   | member+  |
| [調査更新（開閉・タイトル）](#surveys-id-patch)               | PATCH  | `/:orgSlug/concerts/:concertId/surveys/:surveyId`                                   | tech+    |
| [オンステ調査回答](#surveys-respond)                          | PUT    | `/:orgSlug/concerts/:concertId/surveys/:surveyId/respond`                           | member+  |
| [調査回答をオンステ確定に反映](#survey-apply)                 | POST   | `/:orgSlug/concerts/:concertId/surveys/:surveyId/apply`                             | tech+    |
| [フォーメーションパターン作成](#formation-patterns-create)    | POST   | `/:orgSlug/concerts/:concertId/stages/:stageId/formation-patterns`                  | tech+    |
| [フォーメーションパターン更新](#formation-patterns-patch)     | PATCH  | `/:orgSlug/concerts/:concertId/stages/:stageId/formation-patterns/:patternId`       | tech+    |
| [フォーメーションパターン削除](#formation-patterns-delete)    | DELETE | `/:orgSlug/concerts/:concertId/stages/:stageId/formation-patterns/:patternId`       | tech+    |
| [フォーメーションパターン並び替え](#formation-patterns-order) | PUT    | `/:orgSlug/concerts/:concertId/stages/:stageId/formation-patterns/order`            | tech+    |
| [枠・スロット一括保存](#formation-slots-save)                 | PUT    | `/:orgSlug/concerts/:concertId/stages/:stageId/formation-patterns/:patternId/slots` | tech+    |

### メール

| API名                                         | Method | Path                              | 権限             |
| --------------------------------------------- | ------ | --------------------------------- | ---------------- |
| [メール一覧取得](#mailing-list)               | GET    | `/:orgSlug/mailing`               | 送信者 or 受信者 |
| [メール詳細取得](#mailing-id-get)             | GET    | `/:orgSlug/mailing/:id`           | 送信者 or 受信者 |
| [メール送信](#mailing-send)                   | POST   | `/:orgSlug/mailing/send`          | member+          |
| [テンプレート一覧](#mailing-templates-list)   | GET    | `/:orgSlug/mailing/templates`     | member+          |
| [テンプレート保存](#mailing-templates-save)   | POST   | `/:orgSlug/mailing/templates`     | member+          |
| [テンプレート更新](#mailing-templates-update) | PATCH  | `/:orgSlug/mailing/templates/:id` | 作成者 or admin  |
| [テンプレート削除](#mailing-templates-delete) | DELETE | `/:orgSlug/mailing/templates/:id` | 作成者 or admin  |

### チケット管理

| API名                                       | Method | Path                                                    | 権限                       |
| ------------------------------------------- | ------ | ------------------------------------------------------- | -------------------------- |
| [チケット管理一覧](#tickets-list)           | GET    | `/:orgSlug/tickets`                                     | ticket or admin            |
| [チケット一覧（自分）](#tickets-my-get)     | GET    | `/:orgSlug/tickets/my`                                  | member+                    |
| [チケット集計取得](#tickets-id-get)         | GET    | `/:orgSlug/tickets/:concertId`                          | ticket or admin            |
| [席種作成](#tickets-batches-create)         | POST   | `/:orgSlug/tickets/:concertId/batches`                  | ticket or admin            |
| [席種削除](#tickets-batches-delete)         | DELETE | `/:orgSlug/tickets/:concertId/batches/:batchId`         | admin                      |
| [チケット配布記録](#tickets-allocate)       | POST   | `/:orgSlug/tickets/:concertId/allocate`                 | admin / member（自分のみ） |
| [販売・回収報告](#tickets-allocation-patch) | PATCH  | `/:orgSlug/tickets/allocations/:id`                     | member（自分）/ admin      |
| [パートレース取得](#tickets-race)           | GET    | `/:orgSlug/tickets/:concertId/race`                     | ticket or admin            |
| [レース公開](#tickets-race-publish)         | POST   | `/:orgSlug/tickets/:concertId/race/publish`             | ticket or admin            |
| [レース非公開](#tickets-race-unpublish)     | DELETE | `/:orgSlug/tickets/:concertId/race/publish`             | ticket or admin            |
| [入力締め切り](#tickets-close)              | POST   | `/:orgSlug/tickets/:concertId/close`                    | ticket or admin            |
| [入力再開](#tickets-reopen)                 | DELETE | `/:orgSlug/tickets/:concertId/close`                    | ticket or admin            |
| [情宣活動一覧取得](#outreach-list)          | GET    | `/:orgSlug/tickets/:concertId/outreach`                 | member+                    |
| [情宣活動申請](#outreach-create)            | POST   | `/:orgSlug/tickets/:concertId/outreach`                 | member+                    |
| [交通費支払い承認](#outreach-pay)           | PATCH  | `/:orgSlug/tickets/:concertId/outreach/:activityId/pay` | ticket or admin            |
| [情宣活動削除](#outreach-delete)            | DELETE | `/:orgSlug/tickets/:concertId/outreach/:activityId`     | 申請者 or ticket or admin  |

### 設定

| API名                                            | Method | Path                                        | 権限     |
| ------------------------------------------------ | ------ | ------------------------------------------- | -------- |
| [設定取得](#settings-get)                        | GET    | `/:orgSlug/settings`                        | admin    |
| [団体情報更新](#settings-org-patch)              | PATCH  | `/:orgSlug/settings/org`                    | admin    |
| [パート追加](#parts-create)                      | POST   | `/:orgSlug/settings/parts`                  | admin    |
| [パート更新](#parts-patch)                       | PATCH  | `/:orgSlug/settings/parts/:id`              | admin    |
| [パート削除](#parts-delete)                      | DELETE | `/:orgSlug/settings/parts/:id`              | admin    |
| [会費設定更新](#settings-fee-patch)              | PATCH  | `/:orgSlug/settings/fee`                    | admin    |
| [支出カテゴリ一覧取得](#expense-categories-list) | GET    | `/:orgSlug/settings/expense-categories`     | finance+ |
| [支出カテゴリ追加](#expense-categories-create)   | POST   | `/:orgSlug/settings/expense-categories`     | admin    |
| [支出カテゴリ更新](#expense-categories-patch)    | PATCH  | `/:orgSlug/settings/expense-categories/:id` | admin    |
| [支出カテゴリ削除](#expense-categories-delete)   | DELETE | `/:orgSlug/settings/expense-categories/:id` | admin    |
| [メンバー区分一覧取得](#member-types-list)       | GET    | `/:orgSlug/settings/member-types`           | member+  |
| [メンバー区分追加](#member-types-create)         | POST   | `/:orgSlug/settings/member-types`           | admin    |
| [メンバー区分更新](#member-types-patch)          | PATCH  | `/:orgSlug/settings/member-types/:id`       | admin    |
| [メンバー区分削除](#member-types-delete)         | DELETE | `/:orgSlug/settings/member-types/:id`       | admin    |
| [イベント区分一覧取得](#event-categories-list)   | GET    | `/:orgSlug/settings/event-categories`       | member+  |
| [イベント区分追加](#event-categories-create)     | POST   | `/:orgSlug/settings/event-categories`       | admin    |
| [イベント区分更新](#event-categories-patch)      | PATCH  | `/:orgSlug/settings/event-categories/:id`   | admin    |
| [イベント区分削除](#event-categories-delete)     | DELETE | `/:orgSlug/settings/event-categories/:id`   | admin    |

### 会計

| API名                                       | Method | Path                                                   | 権限     |
| ------------------------------------------- | ------ | ------------------------------------------------------ | -------- |
| [収支サマリー取得](#accounting-summary)     | GET    | `/:orgSlug/finance/summary`                            | finance+ |
| [徴収一覧取得](#collections-list)           | GET    | `/:orgSlug/finance/collections`                        | finance+ |
| [徴収作成](#collections-create)             | POST   | `/:orgSlug/finance/collections`                        | finance+ |
| [徴収詳細取得](#collections-id-get)         | GET    | `/:orgSlug/finance/collections/:id`                    | finance+ |
| [徴収削除](#collections-id-delete)          | DELETE | `/:orgSlug/finance/collections/:id`                    | admin    |
| [支払い記録更新](#collection-payment-patch) | PATCH  | `/:orgSlug/finance/collections/:id/payments/:memberId` | finance+ |
| [支出一覧取得](#expenses-list)              | GET    | `/:orgSlug/finance/expenses`                           | finance+ |
| [支出登録](#expenses-create)                | POST   | `/:orgSlug/finance/expenses`                           | finance+ |
| [支出更新](#expenses-patch)                 | PATCH  | `/:orgSlug/finance/expenses/:id`                       | finance+ |
| [支出削除](#expenses-delete)                | DELETE | `/:orgSlug/finance/expenses/:id`                       | finance+ |

---

## 1. 概要・共通仕様

### 1.1 URL構造

```text
/api/v1/auth/...              # 認証（テナント不問）
/api/v1/:orgSlug/...          # テナント別リソース
```

### 1.2 認証・ミドルウェア

すべての `/api/v1/:orgSlug/` 配下のエンドポイントは以下のミドルウェアを通過する。

```text
リクエスト
  │
  ├─ [1] JWT検証（Lucia v3 セッショントークン）
  ├─ [2] orgSlug → orgId 解決・テナント存在確認
  ├─ [3] Member レコード取得 → ctx.member にセット
  └─ [4] 以降の全 DB クエリに orgId を自動付与
```

**認証ヘッダー:**

```http
Cookie: session=<session_token>
```

### 1.3 共通レスポンス形式

**成功:**

```json
{
  "data": { ... }
}
```

リスト系は `data` が配列。ページネーションがある場合は `meta` を付与。

```json
{
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20
  }
}
```

**エラー:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "認証が必要です"
  }
}
```

### 1.4 共通エラーコード

| HTTPステータス | code                | 説明                                              |
| -------------- | ------------------- | ------------------------------------------------- |
| 400            | `VALIDATION_ERROR`  | バリデーションエラー。`details` に Zod エラー詳細 |
| 401            | `UNAUTHORIZED`      | 未認証                                            |
| 403            | `FORBIDDEN`         | 権限不足                                          |
| 404            | `NOT_FOUND`         | リソースが存在しない                              |
| 409            | `CONFLICT`          | 重複登録など                                      |
| 429            | `TOO_MANY_REQUESTS` | レート制限超過                                    |
| 500            | `INTERNAL_ERROR`    | サーバーエラー                                    |

### 1.5 権限チェック記法

本書では各エンドポイントの「最低必要ロール」を以下の表記で示す。

| 表記              | 意味                                         |
| ----------------- | -------------------------------------------- |
| `admin`           | 最高管理者のみ                               |
| `tech+`           | tech 以上（tech / admin）                    |
| `score+`          | score 以上（score / admin）                  |
| `tech+, score+`   | tech または score 以上（どちらか一方でよい） |
| `member+`         | ログイン済み全員（guest / visitor を除く）   |
| `self or admin`   | 自分自身 または admin                        |
| `ticket or admin` | `ticket` ロール保有者 または `admin`         |

---

## 2. 認証 API

<a id="auth-login"></a>

### POST `/api/v1/auth/login`

メールアドレスとパスワードでログイン。セッションクッキーを発行する。

**権限**: なし（公開）

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response** `200`

```json
{
  "data": {
    "user": {
      "id": "cuid",
      "nameJa": "山田 太郎",
      "email": "user@example.com",
      "avatarUrl": null
    },
    "orgs": [
      {
        "orgSlug": "tokyo-men-choir",
        "orgName": "男声合唱団A",
        "roles": ["member"],
        "partName": "Tenor I",
        "status": "active"
      },
      {
        "orgSlug": "mixed-choir-b",
        "orgName": "混声合唱団B",
        "roles": ["tech"],
        "partName": "Bass",
        "status": "active"
      }
    ]
  }
}
```

> `orgs` が1件 → クライアントは `/{orgs[0].orgSlug}` へ自動遷移。複数件 → `/orgs` へ遷移してユーザーに選択させる。

Set-Cookie: `session=<token>; HttpOnly; Secure; SameSite=Lax`

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正 / `401` `UNAUTHORIZED` メールアドレスまたはパスワードが不正 / `429` `TOO_MANY_REQUESTS` レート制限超過

---

<a id="auth-logout"></a>

### POST `/api/v1/auth/logout`

セッションを破棄する。

**権限**: ログイン済み

**Response** `204` No Content

---

<a id="auth-me"></a>

### GET `/api/v1/auth/me`

現在のログインユーザー情報を返す。

**権限**: ログイン済み

**Response** `200`

```json
{
  "data": {
    "user": {
      "id": "cuid",
      "nameJa": "山田 太郎",
      "email": "user@example.com",
      "avatarUrl": null
    },
    "orgs": [
      {
        "orgSlug": "tokyo-men-choir",
        "orgName": "男声合唱団A",
        "memberId": "cuid",
        "roles": ["member", "tech"],
        "partName": "Tenor I",
        "status": "active"
      },
      {
        "orgSlug": "mixed-choir-b",
        "orgName": "混声合唱団B",
        "memberId": "cuid",
        "roles": ["member"],
        "partName": "Bass",
        "status": "active"
      }
    ]
  }
}
```

**Errors:**: `401` `UNAUTHORIZED` 未認証（Cookie無し・セッション無効/期限切れ）

---

<a id="auth-invite-get"></a>

### GET `/api/v1/auth/invite/:token`

招待トークンの有効性を確認し、対応するメールアドレスを返す。

**権限**: なし（公開）

**Response** `200`

```json
{
  "data": {
    "email": "new@example.com",
    "nameJa": "山田 太郎",
    "orgName": "男声合唱団A",
    "orgSlug": "tokyo-men-choir",
    "expiresAt": "2026-06-11T00:00:00Z"
  }
}
```

**Errors:**: `404` `INVALID_TOKEN` トークンが存在しない / `404` `TOKEN_USED` 使用済み / `404` `TOKEN_EXPIRED` 期限切れ

---

<a id="auth-invite-post"></a>

### POST `/api/v1/auth/invite/:token`

招待トークンを使って新規メンバー登録を完了する。

**権限**: なし（公開）

**Request Body:**

```json
{
  "nameJa": "山田 太郎",
  "password": "newpassword"
}
```

**Response** `201`

```json
{ "data": { "message": "登録が完了しました" } }
```

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正 / `401` `UNAUTHORIZED` 既存ユーザーのパスワード不一致 / `404` `INVALID_TOKEN` トークンが存在しない / `404` `TOKEN_USED` 使用済み / `404` `TOKEN_EXPIRED` 期限切れ / `409` `CONFLICT` 同一メールが既に登録済み

---

<a id="auth-password-reset-request"></a>

### POST `/api/v1/auth/password-reset/request`

パスワードリセット用メールを送信する。ユーザーが存在しないメールアドレスでも同一レスポンスを返す（ユーザー列挙防止）。

**権限**: なし（公開）

**Request Body:**

```json
{ "email": "member@example.com" }
```

**Response** `200`

```json
{ "data": { "message": "パスワードリセットメールを送信しました" } }
```

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正 / `429` `TOO_MANY_REQUESTS` レート制限超過

---

<a id="auth-password-reset-get"></a>

### GET `/api/v1/auth/password-reset/:token`

パスワードリセットトークンを検証し、対象メールアドレスを返す（新パスワード設定画面の初期表示用）。

**権限**: なし（公開）

**Response** `200`

```json
{ "data": { "email": "member@example.com" } }
```

**Errors:**: `404` `INVALID_TOKEN` トークンが存在しない / `404` `TOKEN_USED` 使用済み / `404` `TOKEN_EXPIRED` 期限切れ

---

<a id="auth-password-reset-confirm"></a>

### POST `/api/v1/auth/password-reset/:token`

新しいパスワードを設定する。成功時は当該ユーザーの全セッションを削除する。

**権限**: なし（公開）

**Request Body:**

```json
{ "password": "newpassword" }
```

**Response** `200`

```json
{ "data": { "message": "パスワードをリセットしました" } }
```

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正 / `404` `INVALID_TOKEN` トークンが無効・期限切れ・使用済み（原子的な更新のため詳細な理由は区別しない）

---

<a id="auth-orgs-create"></a>

### POST `/api/v1/auth/orgs`

新しい団体を作成し、作成者を `admin` として登録する。4つの標準イベント区分（練習・本番・会議・その他）を自動生成する。

**権限**: ログイン済み

**Request Body:**

| フィールド | 型     | 必須 | 説明                                              |
| ---------- | ------ | ---- | ------------------------------------------------- |
| name       | string | ✓    | 団体名（最大100文字）                             |
| slug       | string | ✓    | URL スラグ（英小文字・数字・ハイフン、2〜50文字） |

```json
{ "name": "○○男声合唱団", "slug": "circle-choir" }
```

**Response** `201`

```json
{ "data": { "orgSlug": "circle-choir", "orgName": "○○男声合唱団" } }
```

**Errors:**: `400` `VALIDATION_ERROR` バリデーションエラー / `401` `UNAUTHORIZED` 未認証 / `409` `CONFLICT` スラグ重複

---

## 3. ホーム API

<a id="home-get"></a>

### GET `/api/v1/:orgSlug/home`

ホーム画面に必要なデータを一括取得する。

**権限**: `member+`

**Response** `200`

```json
{
  "data": {
    "upcomingEvents": [
      {
        "id": "cuid",
        "title": "第12回定期練習",
        "category": { "id": "cuid_cat", "name": "練習", "slug": "rehearsal", "color": "#3B82F6" },
        "startsAt": "2026-06-10T18:30:00+09:00",
        "location": "○○公民館",
        "concertId": null,
        "myAttendance": "attending"
      }
    ],
    "nextRehearsal": {
      "id": "cuid",
      "title": "第12回定期練習",
      "category": { "id": "cuid_cat", "name": "練習", "slug": "rehearsal", "color": "#3B82F6" },
      "startsAt": "2026-06-10T18:30:00+09:00",
      "location": "○○公民館",
      "concertId": null,
      "myAttendance": "attending"
    },
    "nextConcert": {
      "id": "cuid",
      "title": "第20回定期演奏会",
      "category": { "id": "cuid_cat2", "name": "本番", "slug": "concert", "color": "#EF4444" },
      "startsAt": "2026-07-25T14:00:00+09:00",
      "location": "○○ホール",
      "concertId": "cuid",
      "myAttendance": "attending"
    },
    "unansweredEventCount": 2,
    "recentMails": [
      {
        "id": "cuid",
        "subject": "6月練習のご案内",
        "sentAt": "2026-05-30T12:00:00+09:00"
      }
    ],
    "canViewTickets": false,
    "ticketRaceWinner": null
  }
}
```

---

## 4. メンバー管理 API

<a id="members-list"></a>

### GET `/api/v1/:orgSlug/members`

メンバー一覧を取得する。

**権限**: `member+`（`guest` は簡易情報のみ）

**Query Parameters:**

| パラメータ | 型     | 説明                                           |
| ---------- | ------ | ---------------------------------------------- |
| partId     | string | パートでフィルタ                               |
| status     | string | `active` / `offstage` / `alumni` / `suspended` |
| role       | string | ロールでフィルタ                               |

**Response** `200`

```json
{
  "data": [
    {
      "id": "cuid",
      "nameJa": "山田 太郎",
      "nameEn": "Taro Yamada",
      "part": { "id": "cuid", "name": "Tenor I" },
      "roles": ["member"],
      "isConductor": false,
      "status": "active",
      "avatarUrl": "https://...",
      "bio": "よろしくお願いします",
      "job": "エンジニア",
      "interests": "コーヒー",
      "joinedAt": "2020-04-01"
    }
  ]
}
```

> `email` / `phone` / `adminMemo` は `admin` のみレスポンスに含まれる

---

<a id="members-me-get"></a>

### GET `/api/v1/:orgSlug/members/me`

自分のプロフィールを取得する（`phone` / `adminMemo` を含む）。

**権限**: `member+`

**Response** `200` → 全フィールドを返す

---

<a id="members-me-patch"></a>

### PATCH `/api/v1/:orgSlug/members/me`

自分のプロフィールを更新する。メールアドレスの変更はセキュリティ上このエンドポイントでは受け付けない（管理者が `PATCH /members/:id` で変更する）。

**権限**: `member+`

**Request Body:**（すべて省略可）

```json
{
  "nameJa": "山田 太郎",
  "nameEn": "Taro Yamada",
  "bio": "よろしくお願いします",
  "job": "エンジニア",
  "interests": "コーヒー",
  "originGroup": "○○大学合唱団",
  "avatarUrl": "https://..."
}
```

**Response** `200` → 更新後のメンバー情報

---

<a id="members-me-avatar"></a>

### POST `/api/v1/:orgSlug/members/me/avatar`

プロフィールアバター画像をアップロードする。

**権限**: `member+`

**Request**: multipart/form-data、フィールド名 `avatar`（JPEG/PNG/GIF、最大5MB）

**Response** `200`

```json
{ "data": { "avatarUrl": "/uploads/avatars/xxx.jpg" } }
```

---

<a id="members-invite"></a>

### POST `/api/v1/:orgSlug/members/invite`

招待メールを送信する。トークン付き招待 URL をメールで送る。

**権限**: `admin`

**Request Body:**

```json
{
  "email": "new@example.com",
  "roles": ["member"],
  "partId": "cuid"
}
```

**Response** `201`

```json
{
  "data": { "inviteToken": "xxx", "expiresAt": "2026-06-11T00:00:00Z" }
}
```

**Errors:**: `409` すでに登録済みのメールアドレス

---

<a id="members-id-get"></a>

### GET `/api/v1/:orgSlug/members/:id`

メンバー詳細を取得する。

**権限**: `member+`

**Response** `200` → 一覧と同じ形式（単一オブジェクト）

---

<a id="members-id-patch"></a>

### PATCH `/api/v1/:orgSlug/members/:id`

メンバー情報を管理者が更新する（ロール変更・ステータス変更など）。

**権限**: `admin`（ただし `self` は `PATCH /members/me` を使う）

**Request Body:**（すべて省略可）

```json
{
  "roles": ["member", "tech"],
  "partId": "cuid",
  "memberTypeId": "cuid",
  "status": "offstage",
  "phone": "090-xxxx-xxxx",
  "adminMemo": "メモ"
}
```

**Response** `200` → 更新後のメンバー情報

---

<a id="parts-list"></a>

### GET `/api/v1/:orgSlug/parts`

パート一覧を取得する。

**権限**: `member+`

**Response** `200`

```json
{ "data": [{ "id": "cuid", "name": "Tenor I", "voiceType": "tenor", "sortOrder": 1 }] }
```

---

## 5. スケジュール・出欠 API

### 招待ロジック概要

各イベントには **`targetRoles`（対象ロール）** と **`targetPartIds`（対象パート）** の2つのフィルタを設定できる。

| `targetRoles`      | `targetPartIds`     | 招待対象                                               |
| ------------------ | ------------------- | ------------------------------------------------------ |
| `null`             | `null`              | 全メンバー                                             |
| `["admin","tech"]` | `null`              | 指定ロールを持つ全メンバー                             |
| `null`             | `["cuid1","cuid2"]` | 指定パートに所属する全メンバー                         |
| `["admin","tech"]` | `["cuid1"]`         | 指定ロール **かつ** 指定パートの両方に該当するメンバー |

- **GET 系エンドポイント**はサーバーが自動的に絞り込みを行い、リクエストユーザーが招待されていないイベントは返さない
- 招待対象外のイベントに対して出欠回答を行うと `403 NOT_INVITED` を返す

---

<a id="events-list"></a>

### GET `/api/v1/:orgSlug/events`

ログインユーザーが招待されているイベント一覧を取得する（カレンダー表示用）。

**権限**: `member+`

> サーバーはリクエストユーザーのロール・パートを参照し、`targetRoles` / `targetPartIds` に一致しないイベントを結果から除外する。

**Query Parameters:**

| パラメータ | 型           | 説明                                  |
| ---------- | ------------ | ------------------------------------- |
| from       | ISO8601 date | 期間始端（例: 2026-06-01）            |
| to         | ISO8601 date | 期間終端（例: 2026-06-30）            |
| type       | string       | rehearsal / concert / meeting / other |

**Response** `200`

```json
{
  "data": [
    {
      "id": "cuid",
      "title": "第12回定期練習",
      "category": { "id": "cuid_cat", "name": "練習", "slug": "rehearsal", "color": "#3B82F6" },
      "startsAt": "2026-06-10T18:30:00+09:00",
      "endsAt": "2026-06-10T21:00:00+09:00",
      "location": "○○公民館",
      "locationUrl": "https://maps.google.com/...",
      "isLocked": false,
      "targetRoles": null,
      "targetPartIds": null,
      "myAttendance": "undecided"
    },
    {
      "id": "cuid2",
      "title": "役員会議",
      "category": { "id": "cuid_cat2", "name": "会議", "slug": "meeting", "color": "#F59E0B" },
      "startsAt": "2026-06-12T19:00:00+09:00",
      "endsAt": "2026-06-12T21:00:00+09:00",
      "location": "Zoom",
      "locationUrl": "https://zoom.us/...",
      "isLocked": false,
      "targetRoles": ["admin", "tech"],
      "targetPartIds": null,
      "myAttendance": "undecided"
    }
  ]
}
```

---

<a id="events-create"></a>

### POST `/api/v1/:orgSlug/events`

イベントを作成する。

**権限**: `tech+`（admin / tech / conductor）

**Request Body:**

| フィールド    | 型               | 必須 | 説明                                                       |
| ------------- | ---------------- | ---- | ---------------------------------------------------------- |
| title         | string           | ✓    | イベント名                                                 |
| categoryId    | string (cuid)    | ✓    | イベント区分 ID（`GET /settings/event-categories` で取得） |
| startsAt      | ISO8601          | ✓    | 開始日時                                                   |
| endsAt        | ISO8601          | ✓    | 終了日時                                                   |
| location      | string           |      | 場所名                                                     |
| locationUrl   | string           |      | 地図URL等                                                  |
| deadline      | ISO8601          |      | 出欠回答締切                                               |
| pageMemo      | string           |      | 連絡事項                                                   |
| targetRoles   | string[] \| null |      | 招待対象ロール（省略・null = 全員）                        |
| targetPartIds | string[] \| null |      | 招待対象パートID（省略・null = 全パート）                  |

```json
{
  "title": "Tenor パート練習",
  "categoryId": "cuid_rehearsal_category",
  "startsAt": "2026-06-20T18:00:00+09:00",
  "endsAt": "2026-06-20T20:00:00+09:00",
  "location": "○○公民館 第2練習室",
  "locationUrl": "https://maps.google.com/...",
  "deadline": "2026-06-18T23:59:59+09:00",
  "pageMemo": "パート譜を持参してください",
  "targetRoles": null,
  "targetPartIds": ["cuid_tenor1", "cuid_tenor2"]
}
```

**Response** `201` → 作成したイベント情報（招待フィルタ含む）

---

<a id="events-id-get"></a>

### GET `/api/v1/:orgSlug/events/:id`

イベント詳細と招待メンバーの出欠一覧を取得する（伝助ビュー用）。

**権限**: `member+`（招待対象外の場合は `403`）

> - 管理者は全イベントを参照可能
> - 一般メンバーは自分が招待されているイベントのみ参照可能
> - `attendances` には招待されたメンバーのみ含まれる

**Response** `200`

```json
{
  "data": {
    "id": "cuid",
    "title": "Tenor パート練習",
    "category": { "id": "cuid_cat", "name": "練習", "slug": "rehearsal", "color": "#3B82F6" },
    "startsAt": "2026-06-20T18:00:00+09:00",
    "endsAt": "2026-06-20T20:00:00+09:00",
    "location": "○○公民館 第2練習室",
    "locationUrl": "https://...",
    "deadline": "2026-06-18T23:59:59+09:00",
    "pageMemo": "パート譜を持参してください",
    "isLocked": false,
    "targetRoles": null,
    "targetPartIds": ["cuid_tenor1", "cuid_tenor2"],
    "invitedCount": 6,
    "attendances": [
      {
        "member": {
          "id": "cuid",
          "nameJa": "鈴木 一郎",
          "part": { "id": "cuid_tenor1", "name": "Tenor I" }
        },
        "status": "attending",
        "arriveTime": null,
        "leaveTime": null,
        "dayMemo": null
      }
    ],
    "summary": {
      "attending": 4,
      "absent": 1,
      "maybe": 0,
      "undecided": 1
    }
  }
}
```

**Errors:**

| コード            | 説明                 |
| ----------------- | -------------------- |
| `403 NOT_INVITED` | 招待対象外のイベント |
| `404 NOT_FOUND`   | イベントが存在しない |

---

<a id="events-id-patch"></a>

### PATCH `/api/v1/:orgSlug/events/:id`

イベント情報を更新する。

**権限**: `tech+`（admin / tech / conductor）

**Request Body:**: POST と同じ形式（すべて省略可）。`targetRoles` / `targetPartIds` も更新可能。

> `targetPartIds` を変更した場合、新たに招待対象から外れたメンバーの出欠レコードは保持されるが、そのメンバーは以降 GET で当該イベントを参照できなくなる。

**Response** `200` → 更新後のイベント情報

---

<a id="events-id-delete"></a>

### DELETE `/api/v1/:orgSlug/events/:id`

イベントを削除する。

**権限**: `tech+`（admin / tech / conductor）

**Response** `204` No Content

---

<a id="attendance-me"></a>

### PUT `/api/v1/:orgSlug/events/:id/attendance/me`

自分の出欠を登録・更新する。

**権限**: `member+`

> 以下のいずれかに該当する場合は `403` を返す。
>
> - ログインユーザーがイベントの招待対象でない
> - `isLocked: true`（締切後ロック済み）

**Request Body:**

```json
{
  "status": "maybe",
  "arriveTime": "19:00",
  "leaveTime": null,
  "dayMemo": "仕事の都合で19時頃到着予定"
}
```

**Response** `200`

```json
{
  "data": {
    "status": "maybe",
    "arriveTime": "19:00",
    "leaveTime": null,
    "dayMemo": "仕事の都合で19時頃到着予定",
    "updatedAt": "2026-06-05T10:00:00Z"
  }
}
```

**Errors:**

| コード            | 説明                 |
| ----------------- | -------------------- |
| `403 NOT_INVITED` | 招待対象外のイベント |
| `403 LOCKED`      | 締切後ロック済み     |

---

<a id="attendance-proxy"></a>

### PATCH `/api/v1/:orgSlug/events/:id/attendance/:memberId`

管理者が特定メンバーの出欠を更新する。

**権限**: `admin`

> 対象メンバーが招待対象でない場合も `admin` は更新可能（手動補正用途）。

**Request Body:**: PUT /me と同じ形式

**Response** `200` → 更新後の出欠情報

---

## 6. 楽譜管理 API

<a id="scores-list"></a>

### GET `/api/v1/:orgSlug/scores`

楽譜フラット一覧を取得する（曲目選択ピッカー用・軽量レスポンス）。

**権限**: 認証済み全ロール

**Response** `200`

```json
{
  "data": [
    {
      "id": "cuid",
      "title": "男声合唱のための〇〇",
      "composer": "△△ △△",
      "arranger": null
    }
  ]
}
```

---

<a id="scores-grouped"></a>

### GET `/api/v1/:orgSlug/scores/grouped`

楽譜を演奏会別・演奏会未定でグループ化して取得する（楽譜一覧画面用）。ファイル・権限情報は含まず、一覧表示に必要な最小フィールドのみ返す。

**権限**: 認証済み全ロール

**Response** `200`

```json
{
  "data": {
    "concerts": [
      {
        "id": "cuid",
        "title": "第20回定期演奏会",
        "heldOn": "2026-11-23",
        "venue": "○○ホール",
        "stages": [
          {
            "id": "cuid",
            "name": "第1ステージ",
            "sortOrder": 1,
            "programs": [
              {
                "id": "cuid",
                "title": "男声合唱のための〇〇",
                "sortOrder": 1,
                "score": {
                  "id": "cuid",
                  "title": "男声合唱のための〇〇",
                  "composer": "△△ △△",
                  "arranger": null
                }
              }
            ]
          }
        ]
      }
    ],
    "unassigned": [
      {
        "id": "cuid",
        "title": "演奏会未定の曲",
        "composer": null,
        "arranger": null
      }
    ]
  }
}
```

> ファイル・権限・価格情報は `GET /scores/:scoreId`（詳細）で取得する。

---

<a id="scores-create"></a>

### POST `/api/v1/:orgSlug/scores`

楽譜を新規登録する。

**権限**: `admin`

**Request Body:**

| フィールド        | 型             | 必須 | 説明                                 |
| ----------------- | -------------- | ---- | ------------------------------------ |
| title             | string         | ✓    | 曲名                                 |
| composer          | string \| null |      | 作曲者                               |
| arranger          | string \| null |      | 編曲者                               |
| isCommissioned    | boolean        |      | 委嘱作品かどうか（default: `false`） |
| purchaseDate      | string \| null |      | 購入日（ISO8601 date）               |
| distributionStart | string \| null |      | 配布開始日（ISO8601 date）           |
| purchasePrice     | number \| null |      | 仕入価格（円・整数・0以上）          |
| notes             | string \| null |      | 備考                                 |

```json
{
  "title": "男声合唱のための〇〇",
  "composer": "△△ △△",
  "arranger": null,
  "isCommissioned": false,
  "purchaseDate": "2026-10-01",
  "distributionStart": null,
  "purchasePrice": 1200,
  "notes": null
}
```

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "title": "男声合唱のための〇〇",
    "composer": "△△ △△",
    "arranger": null
  }
}
```

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正 / `403` `FORBIDDEN` 管理者以外

---

<a id="scores-detail"></a>

### GET `/api/v1/:orgSlug/scores/:scoreId`

楽譜の詳細情報・ファイル一覧・権限情報を取得する。

**権限**: 認証済み全ロール（ファイル取得可否はロール・購入記録で変わる）

**Response** `200`

```json
{
  "data": {
    "id": "cuid",
    "title": "男声合唱のための〇〇",
    "composer": "△△ △△",
    "arranger": null,
    "isCommissioned": false,
    "accessLevel": "restricted",
    "purchaseDate": "2026-10-01",
    "distributionStart": "2026-10-15",
    "purchasePrice": 1200,
    "distributionPrice": 500,
    "notes": null,
    "canAccessFiles": true,
    "canDownload": true,
    "purchaseCount": 20,
    "hasCollection": false,
    "files": [
      {
        "id": "cuid",
        "fileType": "full_score",
        "fileName": "score_full.pdf",
        "partId": null,
        "partName": null,
        "version": 1,
        "downloadUrl": "/api/v1/:orgSlug/scores/:scoreId/files/:fileId/download"
      }
    ]
  }
}
```

| フィールド      | 条件                                                            |
| --------------- | --------------------------------------------------------------- |
| `purchasePrice` | `score+`（admin / score）のみ返却。それ以外は `undefined`       |
| `purchaseCount` | `score+, tech+, conductor` のみ返却。それ以外は `undefined`     |
| `hasCollection` | 同上。`true` = この楽譜に紐づく徴収が作成済み                   |
| `files`         | `canAccessFiles: true` のときのみ内容を返す（`false` は空配列） |
| `canDownload`   | `visitor` は `false`（PDF をインライン表示のみ可）              |

> `visitor` は `accessLevel` を問わず全楽譜の PDF を閲覧可（`canDownload: false`）。`canAccessFiles: false` の場合は閲覧不可。

**Errors:**: `404` `NOT_FOUND` 楽譜が存在しない、または別テナントの楽譜

---

<a id="scores-meta-patch"></a>

### PATCH `/api/v1/:orgSlug/scores/:scoreId`

楽譜のメタデータを更新する。更新可能なフィールドはロールによって異なる。

**権限**: `score+`（admin / score）

**Request Body:**（すべて省略可）

| フィールド        | 型             | 更新可能ロール | 説明                               |
| ----------------- | -------------- | -------------- | ---------------------------------- |
| title             | string         | admin のみ     | 曲名                               |
| composer          | string \| null | admin のみ     | 作曲者                             |
| arranger          | string \| null | admin のみ     | 編曲者                             |
| accessLevel       | string         | admin のみ     | `secret` / `restricted` / `public` |
| isCommissioned    | boolean        | score+         | 委嘱作品フラグ                     |
| purchaseDate      | string \| null | score+         | 購入日（ISO8601 date）             |
| distributionStart | string \| null | score+         | 配布開始日（ISO8601 date）         |
| purchasePrice     | number \| null | score+         | 仕入価格（円）                     |
| notes             | string \| null | score+         | 備考                               |

```json
{
  "isCommissioned": true,
  "purchaseDate": "2026-10-01",
  "purchasePrice": 1200,
  "notes": "初版"
}
```

**Response** `200`

```json
{
  "data": {
    "id": "cuid",
    "title": "男声合唱のための〇〇",
    "composer": "△△ △△",
    "arranger": null,
    "accessLevel": "restricted",
    "isCommissioned": true,
    "purchaseDate": "2026-10-01",
    "distributionStart": null,
    "purchasePrice": 1200,
    "notes": "初版"
  }
}
```

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正 / `403` `FORBIDDEN` score+ 以外 / `404` `NOT_FOUND` 楽譜が存在しない

---

<a id="scores-price"></a>

### PATCH `/api/v1/:orgSlug/scores/:scoreId/price`

楽譜の団内配布価格を設定する。

**権限**: `score+`

**Request Body:**

| フィールド | 型             | 必須 | 説明                                         |
| ---------- | -------------- | ---- | -------------------------------------------- |
| price      | number \| null | ✓    | 価格（円・整数・0以上）。null で未設定に戻す |

```json
{ "price": 500 }
```

**Response** `200`

```json
{
  "data": {
    "id": "cuid",
    "distributionPrice": 500
  }
}
```

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正 / `403` `FORBIDDEN` score+ 以外 / `404` `NOT_FOUND` 楽譜が存在しない

---

<a id="scores-purchases-get"></a>

### GET `/api/v1/:orgSlug/scores/:scoreId/purchases`

楽譜の購入記録一覧を取得する。

**権限**: `score+`

**Response** `200`

```json
{
  "data": [
    {
      "memberId": "cuid",
      "nameJa": "山田 太郎",
      "partName": "Tenor I",
      "purchasedAt": "2025-10-20",
      "note": null,
      "createdAt": "2025-10-20T10:00:00Z"
    }
  ]
}
```

> `guest`・`visitor` ロールのメンバーは購入記録の対象外（一覧に含まれない）。

**Errors:**: `403` `FORBIDDEN` score+ 以外 / `404` `NOT_FOUND` 楽譜が存在しない

---

<a id="scores-purchases-put"></a>

### PUT `/api/v1/:orgSlug/scores/:scoreId/purchases`

楽譜の購入済みメンバーを一括置換する（チェックボックス一括保存）。

**権限**: `score+`

**Request Body:**

```json
{
  "memberIds": ["cuid1", "cuid2"],
  "purchasedAt": "2026-10-01",
  "note": "10月配布分"
}
```

**Response** `200`

```json
{ "data": { "updated": 2 } }
```

> `memberIds` に他団体のメンバーIDが1件でも含まれる場合、全体を拒否する（サイレント消去防止）。

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正 / `400` `BAD_REQUEST` 他団体のメンバーIDが含まれている / `403` `FORBIDDEN` score+ 以外 / `404` `NOT_FOUND` 楽譜が存在しない

---

<a id="scores-file-presign"></a>

### POST `/api/v1/:orgSlug/scores/:scoreId/files/presign`

R2への直接アップロード用に、プレサインドPUT URLを発行する（本番のアップロードフローの1段階目）。

**権限**: `score+`（PDFなど）/ `tech+`（MIDI）

**Request Body:**

| フィールド  | 型             | 必須 | 説明                            |
| ----------- | -------------- | ---- | ------------------------------- |
| fileType    | string         | ✓    | `full_score` / `midi` / `other` |
| fileName    | string         | ✓    | 元のファイル名（拡張子判定用）  |
| partId      | string \| null |      | パートID（パート譜の場合）      |
| contentType | string         | ✓    | MIMEタイプ                      |

```json
{
  "fileType": "full_score",
  "fileName": "score.pdf",
  "partId": null,
  "contentType": "application/pdf"
}
```

**Response** `200`

```json
{ "data": { "presignedUrl": "https://...", "key": "scores/uuid.pdf" } }
```

> `fileType` ごとに許可される拡張子が決まっている（`full_score`: `.pdf` / `midi`: `.mid` `.midi` `.mp3` / `other`: `.pdf` `.mp3` `.wav`）。`full_score` は1楽譜につき1ファイルのみ（既存があれば409）。

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正・パート不正・拡張子不一致 / `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 楽譜が存在しない / `409` `CONFLICT` 楽譜PDFが登録済み

---

<a id="scores-file-confirm"></a>

### POST `/api/v1/:orgSlug/scores/:scoreId/files/confirm`

プレサインドURLへのアップロード完了後、ファイルをDBに登録する（本番のアップロードフローの2段階目）。

**権限**: `score+`（PDFなど）/ `tech+`（MIDI）

**Request Body:**

| フィールド | 型             | 必須 | 説明                            |
| ---------- | -------------- | ---- | ------------------------------- |
| key        | string         | ✓    | presignで発行された `key`       |
| fileType   | string         | ✓    | `full_score` / `midi` / `other` |
| fileName   | string         | ✓    | 表示用ファイル名                |
| partId     | string \| null |      | パートID（パート譜の場合）      |

```json
{ "key": "scores/uuid.pdf", "fileType": "full_score", "fileName": "score.pdf", "partId": null }
```

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "fileType": "full_score",
    "fileName": "score_full.pdf",
    "partId": null,
    "partName": null,
    "version": 1,
    "downloadUrl": "/api/v1/:orgSlug/scores/:scoreId/files/:fileId/download"
  }
}
```

> `key`・`fileType`・`partId` は presign 発行時のものと独立してクライアントから送られてくるため、ここでも拡張子とfileTypeの整合性・`partId`の所属teナントを検証する。`full_score` の重複が検出された場合、R2上のアップロード済みファイルも削除する。

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正・拡張子不一致・パートが存在しない / `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 楽譜が存在しない / `409` `CONFLICT` 楽譜PDFが登録済み

---

<a id="scores-file-upload"></a>

### POST `/api/v1/:orgSlug/scores/:scoreId/files`

ファイルをアップロードする（`multipart/form-data`、ローカル開発用・R2未設定時のフォールバック）。

**権限**: `score+`（PDFなど）/ `tech+`（MIDI）

**Request Body:** (multipart)

| フィールド | 説明                            |
| ---------- | ------------------------------- |
| `file`     | バイナリファイル                |
| `fileType` | `full_score` / `midi` / `other` |
| `partId`   | パートID（パート譜の場合）      |

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "fileType": "full_score",
    "fileName": "score_full.pdf",
    "partId": null,
    "partName": null,
    "version": 1,
    "downloadUrl": "/api/v1/:orgSlug/scores/:scoreId/files/:fileId/download"
  }
}
```

**Errors:**: `400` `VALIDATION_ERROR` ファイル未選択・fileType不正・パート不正・拡張子不一致 / `400` `FILE_TOO_LARGE` ファイルサイズ超過（最大20MB） / `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 楽譜が存在しない / `409` `CONFLICT` 楽譜PDFが登録済み

---

<a id="scores-file-download"></a>

### GET `/api/v1/:orgSlug/scores/:scoreId/files/:fileId/download`

ファイルをストリーミングダウンロードする。

**権限**: アクセスレベルとロールによる

| ロール                     | secret | restricted                              | public                                  |
| -------------------------- | ------ | --------------------------------------- | --------------------------------------- |
| `visitor`                  | 403    | PDF のみインライン表示、MIDI/音声は 403 | PDF のみインライン表示、MIDI/音声は 403 |
| `member`（購入済み）       | 403    | OK                                      | OK                                      |
| `score` / `tech` / `admin` | OK     | OK                                      | OK                                      |

**Response** `200`

ファイルバイナリをストリーミング返却。レスポンスヘッダー:

```http
Content-Type: application/pdf
Content-Disposition: inline; filename*=UTF-8''%E6%A5%BD%E8%AD%9C.pdf
```

> 日本語ファイル名は RFC 5987 の `filename*=UTF-8''...` 形式でエンコードする。

**Response** `302`

R2設定時（本番環境）は署名付きURLへのリダイレクトを返す（ファイルはサーバーを経由しない）。

> エラー時のレスポンスは他のAPIと異なり、JSONではなく**HTMLエラーページ**を返す（ブラウザの直接遷移・埋め込み表示を想定した設計のため）。

**Errors:**: `403` 体験アカウントがPDF以外にアクセス / `403` 非特権メンバーが`secret`楽譜にアクセス / `403` 非特権メンバーが未購入の楽譜ファイルにアクセス / `404` 楽譜が存在しない / `404` ファイルが存在しない / `404` ストレージ上にファイルが存在しない

---

<a id="scores-file-delete"></a>

### DELETE `/api/v1/:orgSlug/scores/:scoreId/files/:fileId`

ファイルを削除する。

**権限**: `admin` / `score`（PDFなど）・`admin` / `tech` / `conductor`（MIDI）

**Response** `204` No Content

**Errors:**: `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 楽譜が存在しない / `404` `NOT_FOUND` ファイルが存在しない

---

## 7. 本番・オンステ API

<a id="concerts-list"></a>

### GET `/api/v1/:orgSlug/concerts`

演奏会一覧を取得する。

**権限**: `member+`

**Response** `200`

```json
{
  "data": [
    {
      "id": "cuid",
      "title": "第20回定期演奏会",
      "heldOn": "2026-11-23T00:00:00.000Z",
      "venue": "○○ホール",
      "status": "survey_open",
      "stageCount": 3,
      "programCount": 12,
      "hasSurvey": true,
      "surveyOpen": true
    }
  ]
}
```

**Errors:**: `403` `FORBIDDEN` 権限不足

---

<a id="concerts-create"></a>

### POST `/api/v1/:orgSlug/concerts`

演奏会を作成する。あわせてスケジュールと連携するため、`concert`スラグ（無ければ「本番」という名前）のイベント区分を自動で探す／作成し、その区分の`Event`も同時に作成する。

**権限**: `admin`

**Request Body:**

| フィールド    | 型               | 必須 | 説明                                         |
| ------------- | ---------------- | ---- | -------------------------------------------- |
| title         | string           | ✓    | 演奏会名                                     |
| heldOn        | string           | ✓    | 開催日時（ISO8601 datetime、オフセット必須） |
| endsAt        | string           |      | 終了日時（ISO8601 datetime、オフセット必須） |
| venue         | string \| null   |      | 会場名                                       |
| locationUrl   | string \| null   |      | 会場URL（連携Eventに使用）                   |
| targetRoles   | string[] \| null |      | 対象ロール（連携Eventに使用）                |
| targetPartIds | string[] \| null |      | 対象パートID（連携Eventに使用）              |
| deadline      | string \| null   |      | 出欠回答締切（ISO8601 datetime）             |
| pageMemo      | string \| null   |      | 連携Eventのページメモ                        |

```json
{
  "title": "第20回定期演奏会",
  "heldOn": "2026-11-23T00:00:00+09:00",
  "venue": "○○ホール"
}
```

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "title": "第20回定期演奏会",
    "heldOn": "2026-11-23T00:00:00.000Z",
    "venue": "○○ホール",
    "status": "planning",
    "stageCount": 0,
    "programCount": 0,
    "hasSurvey": false,
    "surveyOpen": false,
    "linkedEventId": "cuid"
  }
}
```

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正 / `403` `FORBIDDEN` 権限不足

---

<a id="concerts-structure"></a>

### GET `/api/v1/:orgSlug/concerts/structure`

演奏会とステージの軽量一覧を取得する（曲目の移動・コピー先選択用）。

**権限**: 認証済み全ロール

**Response** `200`

```json
{
  "data": [
    {
      "id": "cuid",
      "title": "第20回定期演奏会",
      "stages": [
        { "id": "cuid", "name": "第1ステージ", "sortOrder": 1 },
        { "id": "cuid", "name": "第2ステージ", "sortOrder": 2 }
      ]
    }
  ]
}
```

**Errors:**: `403` `FORBIDDEN` 権限不足

---

<a id="concerts-id-get"></a>

### GET `/api/v1/:orgSlug/concerts/:id`

演奏会詳細（ステージ・演目・オンステ確定・フォーメーション情報）を取得する。調査自体の回答マトリクスは含まない（[GET .../surveys/:surveyId](#surveys-id-get) で別途取得）。

**権限**: `member+`

**Response** `200`

```json
{
  "data": {
    "id": "cuid",
    "title": "第20回定期演奏会",
    "heldOn": "2026-11-23T00:00:00.000Z",
    "venue": "○○ホール",
    "status": "confirmed",
    "linkedEventId": "cuid",
    "stages": [
      {
        "id": "cuid",
        "name": "第1ステージ",
        "sortOrder": 1,
        "programs": [
          {
            "id": "cuid",
            "title": "男声合唱のための〇〇",
            "sortOrder": 1,
            "score": { "id": "cuid", "composer": "△△", "arranger": null }
          }
        ],
        "formationPatterns": [
          {
            "id": "cuid",
            "name": "パターン1",
            "sortOrder": 1,
            "isStaggered": true,
            "pianoPosition": "center",
            "boxes": [
              { "id": "cuid_box1", "kind": "conductor", "title": null, "sortOrder": 1 },
              { "id": "cuid_box2", "kind": "piano", "title": null, "sortOrder": 2 }
            ],
            "slots": [
              {
                "id": "cuid",
                "memberId": "cuid",
                "nameJa": "山田 太郎",
                "partName": "Tenor I",
                "label": null,
                "boxId": null,
                "rowNum": 1,
                "positionOrder": 1
              },
              {
                "id": "cuid",
                "memberId": null,
                "nameJa": null,
                "partName": null,
                "label": "指揮者名",
                "boxId": "cuid_box1",
                "rowNum": null,
                "positionOrder": 1
              }
            ]
          }
        ]
      }
    ],
    "surveys": [
      {
        "id": "cuid",
        "title": "第20回定演 出演調査",
        "isOpen": false,
        "openAt": "2026-08-01T00:00:00+09:00",
        "closeAt": "2026-08-31T23:59:59+09:00",
        "responseCount": 42
      }
    ],
    "appliedSurveyId": "cuid",
    "assignments": [
      {
        "memberId": "cuid",
        "nameJa": "山田 太郎",
        "partId": "cuid",
        "partName": "Tenor I",
        "partSortOrder": 1,
        "partVoiceType": "tenor",
        "stageId": "cuid",
        "status": "on"
      }
    ]
  }
}
```

> `visitor` ロールはステージ構成（`stages[].programs`）のみを取得でき、`stages[].formationPatterns` は含まれず（キー自体が省略される）、`surveys` / `assignments` は空配列になる。`guest` / `visitor` は `assignments` / `formationPatterns[].slots` の対象メンバーから除外される。`surveys` の回答マトリクス自体（`rows`）は [GET .../surveys/:surveyId](#surveys-id-get) で取得する。

**Errors:**: `404` `NOT_FOUND` 演奏会が存在しない

---

<a id="concerts-id-patch"></a>

### PATCH `/api/v1/:orgSlug/concerts/:id`

演奏会の基本情報を更新する。

**権限**: `admin`

**Request Body:**（すべて省略可）

```json
{
  "title": "第20回定期演奏会",
  "heldOn": "2026-11-23T00:00:00+09:00",
  "venue": "○○ホール",
  "status": "survey_open"
}
```

**Response** `200` → 更新後の演奏会情報

---

<a id="concerts-id-delete"></a>

### DELETE `/api/v1/:orgSlug/concerts/:id`

演奏会を削除する。リンクされた Event も同時に削除する。

**権限**: `admin`

**Response** `204` No Content

---

<a id="stage-create"></a>

### POST `/api/v1/:orgSlug/concerts/:concertId/stages`

ステージを追加する。

**権限**: `admin`

**Request Body:**

```json
{ "name": "第2ステージ" }
```

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "name": "第2ステージ",
    "sortOrder": 2,
    "programs": []
  }
}
```

**Errors:**: `400` `VALIDATION_ERROR` name未入力 / `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 演奏会が存在しない

---

<a id="stage-patch"></a>

### PATCH `/api/v1/:orgSlug/concerts/:concertId/stages/:stageId`

ステージ名を更新する。

**権限**: `admin`

**Request Body:**

```json
{ "name": "第2ステージ（委嘱作品）" }
```

**Response** `200`

```json
{ "data": { "id": "cuid", "name": "第2ステージ（委嘱作品）", "sortOrder": 2 } }
```

**Errors:**: `400` `VALIDATION_ERROR` name未入力 / `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 演奏会が存在しない / `404` `NOT_FOUND` ステージが存在しない・この演奏会に属さない

---

<a id="stages-order"></a>

### PUT `/api/v1/:orgSlug/concerts/:concertId/stages/order`

ステージの並び順を更新する。

**権限**: `admin`

**Request Body:**

```json
{ "ids": ["cuid_stage2", "cuid_stage1", "cuid_stage3"] }
```

> `ids` に指定した順番が `sortOrder` になる（index 0 → sortOrder 1）。この演奏会の全ステージを網羅している必要はなく、指定されたステージのみ並び替えられる。

**Response** `204` No Content

**Errors:**: `400` `VALIDATION_ERROR` idsが空 / `400` `BAD_REQUEST` この演奏会に属さないステージIDが含まれる / `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 演奏会が存在しない

---

<a id="program-create"></a>

### POST `/api/v1/:orgSlug/concerts/:concertId/stages/:stageId/programs`

演目を追加する。新しく楽譜を作成して追加するか、既存楽譜を指定して追加するかを選べる。

**権限**: `admin`

**Request Body:**

| フィールド  | 型             | 必須 | 説明                                                                            |
| ----------- | -------------- | ---- | ------------------------------------------------------------------------------- |
| scoreId     | string         | △    | 既存楽譜ID。`title` と排他（どちらか必須）                                      |
| title       | string         | △    | 曲名。`scoreId` 未指定時は必須。新規楽譜を作成する                              |
| composer    | string \| null |      | 作曲者（新規作成時のみ有効）                                                    |
| arranger    | string \| null |      | 編曲者（新規作成時のみ有効）                                                    |
| accessLevel | string         |      | `secret` / `restricted` / `public`（新規作成時のみ有効、default: `restricted`） |

```json
{ "scoreId": "cuid" }
```

```json
{
  "title": "男声合唱のための〇〇",
  "composer": "△△ △△",
  "arranger": null
}
```

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "title": "男声合唱のための〇〇",
    "sortOrder": 3,
    "score": { "id": "cuid", "composer": "△△ △△", "arranger": null }
  }
}
```

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正・`scoreId`も`title`も指定されていない / `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 演奏会が存在しない / `404` `NOT_FOUND` ステージが存在しない・この演奏会に属さない / `404` `NOT_FOUND` `scoreId`指定時、楽譜が存在しない・別テナント

---

<a id="programs-order"></a>

### PUT `/api/v1/:orgSlug/concerts/:concertId/stages/:stageId/programs/order`

演目の並び順を更新する。

**権限**: `admin`

**Request Body:**

```json
{ "ids": ["cuid_prog3", "cuid_prog1", "cuid_prog2"] }
```

**Response** `204` No Content

**Errors:**: `400` `VALIDATION_ERROR` idsが空 / `400` `BAD_REQUEST` このステージに属さない演目IDが含まれる / `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 演奏会が存在しない / `404` `NOT_FOUND` ステージが存在しない・この演奏会に属さない

---

<a id="program-delete"></a>

### DELETE `/api/v1/:orgSlug/concerts/:concertId/programs/:programId`

演目をステージから削除する。楽譜（Score）本体は削除されない。

**権限**: `admin`

**Response** `204` No Content

**Errors:**: `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 演奏会が存在しない / `404` `NOT_FOUND` 演目が存在しない・指定の演奏会に属していない

---

<a id="program-patch"></a>

### PATCH `/api/v1/:orgSlug/concerts/:concertId/programs/:programId`

演目のタイトル・作曲者・編曲者を編集する。`composer`/`arranger`は紐づく楽譜（Score）本体を更新する。

**権限**: `admin`

**Request Body:**

| フィールド | 型             | 必須 | 説明   |
| ---------- | -------------- | ---- | ------ |
| title      | string         |      | 演目名 |
| composer   | string \| null |      | 作曲者 |
| arranger   | string \| null |      | 編曲者 |

```json
{ "title": "男声合唱のための〇〇（改訂版）" }
```

**Response** `200`

```json
{
  "data": {
    "id": "cuid",
    "title": "男声合唱のための〇〇（改訂版）",
    "sortOrder": 3,
    "score": { "id": "cuid", "composer": "△△ △△", "arranger": null }
  }
}
```

**Errors:**: `400` `VALIDATION_ERROR` 入力値が不正 / `403` `FORBIDDEN` 権限不足 / `404` `NOT_FOUND` 演奏会が存在しない / `404` `NOT_FOUND` 演目が存在しない・指定の演奏会に属していない

---

<a id="surveys-create"></a>

### POST `/api/v1/:orgSlug/concerts/:concertId/surveys`

オンステ調査を開設する。ステージ × 全アクティブメンバーの `SurveyResponse` を自動生成する。既存の開放中調査は自動クローズされる。

**権限**: `tech+`（admin / tech / conductor / score）

**Request Body:**

```json
{
  "title": "第20回定演 出演調査",
  "closeAt": "2026-08-31T23:59:59+09:00"
}
```

> `closeAt` は省略可（null = 手動クローズ）。

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "title": "第20回定演 出演調査",
    "isOpen": true,
    "closeAt": "2026-08-31T23:59:59+09:00"
  }
}
```

---

<a id="surveys-id-get"></a>

### GET `/api/v1/:orgSlug/concerts/:concertId/surveys/:surveyId`

調査の詳細と全メンバーの回答マトリクスを取得する。

**権限**: `member+`（visitor 除く）

**Response** `200`

```json
{
  "data": {
    "id": "cuid",
    "title": "第20回定演 出演調査",
    "isOpen": true,
    "closeAt": "2026-08-31T23:59:59+09:00",
    "stageSummaries": [
      {
        "stageId": "cuid_st1",
        "summary": { "attending": 18, "absent": 3, "undecided": 5 }
      }
    ],
    "rows": [
      {
        "memberId": "cuid",
        "nameJa": "山田 太郎",
        "partId": "cuid_part",
        "partName": "Tenor I",
        "partSortOrder": 1,
        "partVoiceType": "tenor",
        "stages": [{ "stageId": "cuid_st1", "status": "attending" }],
        "memo": "体調次第で欠席するかも"
      }
    ]
  }
}
```

---

<a id="surveys-id-patch"></a>

### PATCH `/api/v1/:orgSlug/concerts/:concertId/surveys/:surveyId`

調査の開閉を切り替える。

**権限**: `tech+`（admin / tech / conductor / score）

**Request Body:**

```json
{ "isOpen": false }
```

**Response** `200`

```json
{ "data": { "id": "cuid", "isOpen": false } }
```

---

<a id="surveys-respond"></a>

### PUT `/api/v1/:orgSlug/concerts/:concertId/surveys/:surveyId/respond`

オンステ調査に回答する（自分 または admin による代理回答）。

**権限**: `member+`

**Request Body:**

```json
{
  "responses": [
    { "stageId": "cuid_st1", "status": "attending" },
    { "stageId": "cuid_st2", "status": "absent" }
  ],
  "memo": "体調によっては欠席するかも",
  "targetMemberId": "cuid"
}
```

> `status` は `attending` / `absent` / `undecided` の3択（`Attendance`（スケジュール出欠）と共有する enum だが、オンステ調査では `maybe` は受け付けない）。  
> `targetMemberId` は admin のみ指定可。省略時は自分の回答として保存。  
> `memo` はステージ横断で共有（全ステージの SurveyResponse に同じ値を書き込む）。  
> 調査が `isOpen: false` かつ admin 以外の場合は `403 LOCKED`。

**Response** `200`

```json
{ "data": { "ok": true } }
```

---

<a id="survey-apply"></a>

### POST `/api/v1/:orgSlug/concerts/:concertId/surveys/:surveyId/apply`

指定した調査の回答内容を `OnStageAssignment`（オンステ確定）に反映する。調査が複数（一次・二次など）ある場合に、どの調査を反映するかを明示的に選べるようにするための操作。開閉状態にかかわらず呼び出せる（締切時の自動反映とは独立）。

**権限**: `tech+`

**Response** `200`

```json
{ "data": { "ok": true } }
```

> 反映すると `Concert.appliedSurveyId` がこの調査の ID になる。`off` になったメンバーは、既存のフォーメーション配置（`FormationSlot`）からも削除される。

---

### フォーメーション管理 API

<a id="formation-patterns-create"></a>

#### POST `/api/v1/:orgSlug/concerts/:concertId/stages/:stageId/formation-patterns`

フォーメーションパターンを新規作成する。

**権限**: `tech+`

**Request Body:**

| フィールド | 型     | 必須 | 説明       |
| ---------- | ------ | ---- | ---------- |
| name       | string | ✓    | パターン名 |

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "name": "パターン1",
    "sortOrder": 1,
    "isStaggered": false,
    "pianoPosition": "center",
    "boxes": [
      { "id": "cuid_box1", "kind": "conductor", "title": null, "sortOrder": 1 },
      { "id": "cuid_box2", "kind": "piano", "title": null, "sortOrder": 2 }
    ],
    "slots": []
  }
}
```

> 作成と同時に `conductor` / `piano` の `FormationBox` を1件ずつ自動作成する。

---

<a id="formation-patterns-patch"></a>

#### PATCH `/api/v1/:orgSlug/concerts/:concertId/stages/:stageId/formation-patterns/:patternId`

パターンの名称・段の千鳥配置・ピアノ位置を更新する（いずれも省略可・部分更新）。

**権限**: `tech+`

**Request Body:**

| フィールド    | 型      | 必須 | 説明                         |
| ------------- | ------- | ---- | ---------------------------- |
| name          | string  |      | パターン名                   |
| isStaggered   | boolean |      | 山台の段を半人分ずつずらすか |
| pianoPosition | string  |      | `center` \| `kamite`         |

**Response** `200` → 更新後のパターン基本情報（`boxes` / `slots` は含まない）

---

<a id="formation-patterns-delete"></a>

#### DELETE `/api/v1/:orgSlug/concerts/:concertId/stages/:stageId/formation-patterns/:patternId`

パターンを削除する（紐づく `FormationBox` / `FormationSlot` もカスケード削除）。

**権限**: `tech+`

**Response** `204`

---

<a id="formation-patterns-order"></a>

#### PUT `/api/v1/:orgSlug/concerts/:concertId/stages/:stageId/formation-patterns/order`

パターンの表示順を並び替える。

**権限**: `tech+`

**Request Body:**

```json
{ "ids": ["cuid_p1", "cuid_p2"] }
```

**Response** `204`

---

<a id="formation-slots-save"></a>

#### PUT `/api/v1/:orgSlug/concerts/:concertId/stages/:stageId/formation-patterns/:patternId/slots`

枠（`boxes`）とスロット（`slots`）をまとめて保存する。既存の枠・スロットを全て削除してから作り直す（フォーメーション編集画面が編集操作のたびに全体を送信する）。

**権限**: `tech+`

**Request Body:**

| フィールド            | 型     | 必須 | 説明                                                                     |
| --------------------- | ------ | ---- | ------------------------------------------------------------------------ |
| boxes                 | array  | ✓    | 枠一覧（最大50件）                                                       |
| boxes[].clientId      | string | ✓    | クライアント側で発行した仮ID（`slots[].boxClientId` から参照）           |
| boxes[].kind          | string | ✓    | `conductor` \| `piano` \| `custom`                                       |
| boxes[].title         | string |      | 枠名（custom のみ）                                                      |
| boxes[].sortOrder     | number | ✓    | 表示順                                                                   |
| slots                 | array  | ✓    | スロット一覧（最大300件）                                                |
| slots[].memberId      | string |      | 団員として配置する場合の Member ID                                       |
| slots[].label         | string |      | 表示名の上書き、または客演・指揮者名（memberId と label はどちらか必須） |
| slots[].boxClientId   | string |      | 枠に配置する場合、対応する `boxes[].clientId`（rowNum とは排他）         |
| slots[].rowNum        | number |      | 山台の段番号（1始まり）。boxClientId とは排他                            |
| slots[].positionOrder | number | ✓    | 枠内での並び順、または山台グリッドの列番号                               |

```json
{
  "boxes": [
    { "clientId": "box:1", "kind": "conductor", "sortOrder": 1 },
    { "clientId": "box:2", "kind": "piano", "sortOrder": 2 },
    { "clientId": "box:3", "kind": "custom", "title": "ソロ", "sortOrder": 3 }
  ],
  "slots": [
    { "memberId": "cuid", "boxClientId": "box:1", "positionOrder": 1 },
    { "label": "指揮者名", "boxClientId": "box:1", "positionOrder": 1 },
    { "memberId": "cuid", "rowNum": 1, "positionOrder": 1 }
  ]
}
```

> `memberId` を指定する場合、そのメンバーが同一団体に属していること（IDOR 防止）に加え、当該ステージで `OnStageAssignment.status: "on"`（オンステ確定済み）であることを検証する。いずれかを満たさない場合は `400 BAD_REQUEST`。`boxClientId` は同リクエスト内の `boxes[].clientId` に存在するものだけを許可する。

**Response** `204`

---

## 8. メール API

> **設計方針**: 件名・本文冒頭は送信時に DB (`mail_logs`) へ保存する。一覧表示は DB のみで完結し Resend API を呼ばない。メール本文 HTML は詳細画面でのみ Resend API から取得する。DB には `subject`・`bodyPreview`・`resendIds`・`recipientMemberIds` を保存する。アクセス制御は「送信者または受信者のみ参照可」とし、admin も例外なし。

<a id="mailing-list"></a>

### GET `/api/v1/:orgSlug/mailing`

送信済みメール履歴一覧を取得する。

**権限**: 送信者（`sentById == member.id`）または受信者（`recipientMemberIds.has(member.id)`）のみ

**Query Parameters:**

| パラメータ | 型     | 説明                     |
| ---------- | ------ | ------------------------ |
| page       | number | ページ番号（default: 1） |
| perPage    | number | 件数（default: 20）      |

**Response** `200`

```json
{
  "data": [
    {
      "id": "cuid",
      "sentBy": { "id": "cuid", "nameJa": "幹事 花子", "avatarUrl": "https://..." },
      "sentAt": "2026-05-30T12:00:00+09:00",
      "recipientCount": 32,
      "subject": "6月練習のご案内",
      "bodyPreview": "みなさんこんにちは。6月の練習日程をお知らせします..."
    }
  ],
  "meta": { "total": 80, "page": 1, "perPage": 20 }
}
```

> `subject`・`bodyPreview` は送信時に DB へ保存済みのため Resend API 呼び出しなし。`avatarUrl` は送信者の User.avatarUrl。  
> `Cache-Control: no-store` ヘッダーを付与する（ブラウザキャッシュ防止）。

---

<a id="mailing-id-get"></a>

### GET `/api/v1/:orgSlug/mailing/:id`

メール詳細を取得する。

**権限**: 送信者または受信者のみ（admin も例外なし）

> 権限なしの場合は `404 NOT_FOUND`（存在を知らせない）。

**Response** `200`

```json
{
  "data": {
    "id": "cuid",
    "sentBy": { "id": "cuid", "nameJa": "幹事 花子" },
    "sentAt": "2026-05-30T12:00:00+09:00",
    "recipientCount": 32,
    "recipients": [
      { "email": "a@example.com", "lastEvent": "delivered" },
      { "email": "b@example.com", "lastEvent": "opened" }
    ],
    "resend": {
      "subject": "6月練習のご案内",
      "html": "<p>みなさんこんにちは...</p>",
      "text": "みなさんこんにちは...",
      "lastEvent": "delivered",
      "createdAt": "2026-05-30T03:00:00.000Z"
    }
  }
}
```

> `recipients` は `resendIds` 各要素に対し Resend API を並列呼び出しして取得。  
> DEV 環境は全員分が `DEV_MAIL_TO` 1件に集約されるため `recipients` は1件のみ。

---

<a id="mailing-send"></a>

### POST `/api/v1/:orgSlug/mailing/send`

メールを送信し、MailLog に保存する。

**権限**: `member+`（全アクティブ団員）

**Request Body:**

```json
{
  "subject": "7月練習のご案内",
  "body": "みなさんこんにちは...",
  "recipientType": "part",
  "recipientFilter": { "partIds": ["cuid", "cuid"] }
}
```

`recipientType` と `recipientFilter` の対応:

| recipientType | recipientFilter                          |
| ------------- | ---------------------------------------- |
| `all`         | null                                     |
| `part`        | `{ "partIds": ["..."] }`                 |
| `role`        | `{ "roles": ["tech", "score"] }`         |
| `custom`      | `{ "memberIds": ["..."] }` （最大500件） |

**Response** `201`

```json
{
  "data": {
    "mailLogId": "cuid",
    "recipientCount": 12,
    "sentAt": "2026-06-04T10:00:00Z"
  }
}
```

---

<a id="mailing-templates-list"></a>

### GET `/api/v1/:orgSlug/mailing/templates`

テンプレート一覧を取得する。

**権限**: `member+`

**Response** `200`

```json
{
  "data": [
    {
      "id": "cuid",
      "name": "練習案内テンプレート",
      "subject": "○月練習のご案内",
      "body": "団員の皆様へ...",
      "createdBy": { "id": "cuid", "nameJa": "山田 太郎" },
      "updatedAt": "2026-06-11T00:00:00Z"
    }
  ]
}
```

---

<a id="mailing-templates-save"></a>

### POST `/api/v1/:orgSlug/mailing/templates`

テンプレートを保存する。

**権限**: `member+`

**Request Body:**

```json
{
  "name": "練習案内テンプレート",
  "subject": "○月練習のご案内",
  "body": "団員の皆様へ..."
}
```

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "name": "練習案内テンプレート",
    "subject": "...",
    "body": "...",
    "updatedAt": "..."
  }
}
```

---

<a id="mailing-templates-update"></a>

### PATCH `/api/v1/:orgSlug/mailing/templates/:id`

テンプレートを更新する。

**権限**: 作成者 or `admin`

**Request Body:** （全フィールド任意）

```json
{ "name": "新しい名前", "subject": "新しい件名", "body": "新しい本文" }
```

**Response** `200` — 更新後のテンプレートオブジェクト

---

<a id="mailing-templates-delete"></a>

### DELETE `/api/v1/:orgSlug/mailing/templates/:id`

テンプレートを削除する。

**権限**: 作成者 or `admin`

**Response** `204`

---

## 9. チケット管理 API

<a id="tickets-id-get"></a>

### GET `/api/v1/:orgSlug/tickets/:concertId`

チケット配布・集計状況を取得する。

**権限**: `ticket or admin`

**Response** `200`

```json
{
  "data": {
    "concert": { "id": "cuid", "title": "第20回定期演奏会" },
    "batches": [
      {
        "id": "cuid",
        "name": "一般",
        "price": 2000,
        "totalCount": 200,
        "allocations": [
          {
            "member": { "id": "cuid", "nameJa": "山田 太郎", "part": { "name": "Tenor I" } },
            "allocatedCount": 10,
            "soldAdult": 6,
            "soldStudent": 1,
            "soldOther": 0,
            "returnedCount": 0,
            "isCollected": false,
            "reportedAt": null
          }
        ]
      }
    ],
    "partSummary": [
      {
        "part": { "name": "Tenor I" },
        "allocated": 40,
        "sold": 28,
        "rate": 0.7
      }
    ]
  }
}
```

---

<a id="tickets-batches-create"></a>

### POST `/api/v1/:orgSlug/tickets/:concertId/batches`

チケット席種を作成する。

**権限**: `ticket or admin`

**Request Body:**

```json
{
  "name": "一般",
  "price": 2000,
  "totalCount": 200,
  "saleStart": "2026-09-01T00:00:00+09:00",
  "saleEnd": "2026-11-20T23:59:59+09:00"
}
```

**Response** `201` → 作成した席種情報

---

<a id="tickets-allocate"></a>

### POST `/api/v1/:orgSlug/tickets/:concertId/allocate`

団員へのチケット配布を記録する。

**権限**: `admin`

**Request Body:**

```json
{
  "batchId": "cuid",
  "allocations": [
    { "memberId": "cuid", "allocatedCount": 10 },
    { "memberId": "cuid", "allocatedCount": 8 }
  ]
}
```

**Response** `201`

```json
{ "data": { "created": 28 } }
```

---

<a id="tickets-allocation-patch"></a>

### PATCH `/api/v1/:orgSlug/tickets/allocations/:id`

販売・回収報告を更新する（自分の配布分の報告、または管理者による全員分の更新）。

**権限**: `member`（自分の記録のみ）/ `admin`（全員）

**Request Body:**（すべて省略可）

```json
{
  "soldAdult": 6,
  "soldStudent": 1,
  "soldOther": 0,
  "returnedCount": 3,
  "outreachCount": 2,
  "isCollected": true,
  "isOutreachExpensePaid": false,
  "allocatedCount": 10
}
```

> `allocatedCount` は `ticket or admin` のみ更新可能。一般団員が指定した場合は無視される。

**Response** `200` → 更新後の配布情報

---

<a id="tickets-race"></a>

### GET `/api/v1/:orgSlug/tickets/:concertId/race`

パートセールスレースの集計データを取得する。

**権限**: `ticket or admin`

**Response** `200`

```json
{
  "data": {
    "isFinalized": false,
    "parts": [
      {
        "partName": "Tenor I",
        "sold": 28,
        "allocated": 40,
        "rate": 0.7,
        "timeline": [
          { "date": "2026-10-01", "cumulativeSold": 5 },
          { "date": "2026-10-15", "cumulativeSold": 18 }
        ]
      }
    ]
  }
}
```

---

## 10. 設定 API

<a id="settings-get"></a>

### GET `/api/v1/:orgSlug/settings`

団体設定情報（団名・パート一覧・ロール設定）を取得する。

**権限**: `admin`

**Response** `200`

```json
{
  "data": {
    "org": { "id": "cuid", "name": "東京男声合唱団", "slug": "tokyo-men-choir" },
    "parts": [{ "id": "cuid", "name": "Tenor I", "voiceType": "tenor", "sortOrder": 1 }]
  }
}
```

---

<a id="settings-org-patch"></a>

### PATCH `/api/v1/:orgSlug/settings/org`

団体情報を更新する。

**権限**: `admin`

**Request Body:**

```json
{ "name": "東京男声合唱団" }
```

**Response** `200` → 更新後の団体情報

---

<a id="parts-create"></a>

### POST `/api/v1/:orgSlug/settings/parts`

パートを追加する。

**権限**: `admin`

**Request Body:**

```json
{
  "name": "Baritone",
  "voiceType": "baritone",
  "sortOrder": 3
}
```

**Response** `201` → 作成したパート情報

---

<a id="parts-patch"></a>

### PATCH `/api/v1/:orgSlug/settings/parts/:id`

パート情報を更新する。

**権限**: `admin`

**Request Body:**: POST と同じ形式（すべて省略可）

**Response** `200` → 更新後のパート情報

---

<a id="parts-delete"></a>

### DELETE `/api/v1/:orgSlug/settings/parts/:id`

パートを削除する。メンバーが紐付いている場合は `409` を返す。

**権限**: `admin`

**Response** `204` No Content

**Errors:**: `409` 団員が紐付いているため削除不可

---

### メンバー区分 (MemberType)

<a id="member-types-list"></a>

### GET `/api/v1/:orgSlug/settings/member-types`

メンバー区分の一覧を取得する。

**権限**: `member+`

**Response** `200`

```json
{
  "data": [{ "id": "cuid", "name": "正団員", "defaultFeeAmount": 3000, "sortOrder": 0 }]
}
```

---

<a id="member-types-create"></a>

### POST `/api/v1/:orgSlug/settings/member-types`

メンバー区分を追加する。

**権限**: `admin`

**Request Body:**

```json
{ "name": "正団員", "defaultFeeAmount": 3000, "sortOrder": 0 }
```

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "name": "正団員",
    "defaultFeeAmount": 3000,
    "sortOrder": 0
  }
}
```

---

<a id="member-types-patch"></a>

### PATCH `/api/v1/:orgSlug/settings/member-types/:id`

メンバー区分を更新する。

**権限**: `admin`

**Request Body:** (partial)

```json
{ "name": "OB", "defaultFeeAmount": 1000 }
```

**Response** `200`

```json
{
  "data": {
    "id": "cuid",
    "name": "OB",
    "defaultFeeAmount": 1000,
    "sortOrder": 1
  }
}
```

---

<a id="member-types-delete"></a>

### DELETE `/api/v1/:orgSlug/settings/member-types/:id`

メンバー区分を削除する。使用中の団員がいる場合は `409` を返す。

**権限**: `admin`

**Response** `204` No Content

**Errors:**: `409` 使用中のメンバーが存在するため削除不可

---

### イベント区分 (EventCategory)

<a id="event-categories-list"></a>

### GET `/api/v1/:orgSlug/settings/event-categories`

イベント区分の一覧を取得する。

**権限**: `member+`

**Response** `200`

```json
{
  "data": [
    {
      "id": "cuid",
      "name": "練習",
      "slug": "rehearsal",
      "color": "#3B82F6",
      "sortOrder": 0
    }
  ]
}
```

> `slug` が `null` のものはユーザー作成区分。`rehearsal` / `concert` / `meeting` / `other` はシステム標準区分で削除不可。

---

<a id="event-categories-create"></a>

### POST `/api/v1/:orgSlug/settings/event-categories`

イベント区分を追加する。

**権限**: `admin`

**Request Body:**

```json
{ "name": "合宿", "color": "#10B981", "sortOrder": 4 }
```

**Response** `201`

```json
{
  "data": {
    "id": "cuid",
    "name": "合宿",
    "slug": null,
    "color": "#10B981",
    "sortOrder": 4
  }
}
```

---

<a id="event-categories-patch"></a>

### PATCH `/api/v1/:orgSlug/settings/event-categories/:id`

イベント区分を更新する。

**権限**: `admin`

**Request Body:** (partial)

```json
{ "name": "合宿・研修", "color": "#6366F1" }
```

**Response** `200`

```json
{ "data": { "id": "cuid", "name": "合宿・研修", "slug": null, "color": "#6366F1", "sortOrder": 4 } }
```

---

<a id="event-categories-delete"></a>

### DELETE `/api/v1/:orgSlug/settings/event-categories/:id`

イベント区分を削除する。システム標準区分（`slug` が非 null）または使用中の場合は削除不可。

**権限**: `admin`

**Response** `204` No Content

**Errors:**:

- `409` システム標準区分は削除不可
- `409` 使用中のイベントが存在するため削除不可

---

## 11. 会計 API

### 11.1 設定

<a id="settings-fee-patch"></a>

### PATCH `/api/v1/:orgSlug/settings/fee`

徴収方式とデフォルト金額を更新する。

**権限**: `admin`

**Request Body:**

```json
{
  "feeType": "per_rehearsal",
  "defaultFeeAmount": 300
}
```

| フィールド       | 型             | 必須 | 説明                        |
| ---------------- | -------------- | ---- | --------------------------- |
| feeType          | string         |      | `per_rehearsal` / `monthly` |
| defaultFeeAmount | number \| null |      | デフォルト徴収金額（円）    |

**Response** `200`

```json
{
  "data": {
    "feeType": "per_rehearsal",
    "defaultFeeAmount": 300
  }
}
```

---

<a id="expense-categories-list"></a>

### GET `/api/v1/:orgSlug/settings/expense-categories`

支出カテゴリ一覧を取得する。

**権限**: `finance+`

**Response** `200`

```json
{
  "data": [
    { "id": "cuid", "name": "会場費", "sortOrder": 0 },
    { "id": "cuid", "name": "指導者謝礼", "sortOrder": 1 }
  ]
}
```

---

<a id="expense-categories-create"></a>

### POST `/api/v1/:orgSlug/settings/expense-categories`

支出カテゴリを追加する。

**権限**: `admin`

**Request Body:**: `{ "name": "合宿費" }`

**Response** `201` → 作成したカテゴリ

---

<a id="expense-categories-patch"></a>

### PATCH `/api/v1/:orgSlug/settings/expense-categories/:id`

カテゴリ名・表示順を更新する。

**権限**: `admin`

**Request Body:**: `{ "name": "合宿・旅費", "sortOrder": 3 }`（省略可）

**Response** `200` → 更新後のカテゴリ

---

<a id="expense-categories-delete"></a>

### DELETE `/api/v1/:orgSlug/settings/expense-categories/:id`

支出カテゴリを削除する。紐付いている Expense がある場合は `409`。

**権限**: `admin`

**Response** `204` No Content

---

### 11.2 収支サマリー

<a id="accounting-summary"></a>

### GET `/api/v1/:orgSlug/finance/summary`

指定年の収支サマリーを取得する。

**権限**: `finance+`

**Query Parameters:**

| パラメータ | 型     | 説明                                        |
| ---------- | ------ | ------------------------------------------- |
| year       | string | 対象年（例: `2026`、4桁の数字）省略時: 当年 |

**Response** `200`

```json
{
  "data": {
    "year": 2026,
    "totalExpense": 18000,
    "totalCollected": 45000,
    "totalPending": 3000,
    "balance": 27000,
    "expenseByCategory": [
      { "categoryId": "cuid", "name": "会場費", "total": 8000 },
      { "categoryId": "cuid", "name": "指導者謝礼", "total": 10000 }
    ]
  }
}
```

---

### 11.3 徴収

<a id="collections-list"></a>

### GET `/api/v1/:orgSlug/finance/collections`

徴収一覧を取得する。

**権限**: `finance+`

**Query Parameters:**

| パラメータ | 型     | 説明                        |
| ---------- | ------ | --------------------------- |
| yearMonth  | string | 月フィルタ（例: `2026-06`） |
| eventId    | string | イベントフィルタ            |

**Response** `200`

```json
{
  "data": [
    {
      "id": "cuid",
      "title": "6/14練習 場所代",
      "amount": 300,
      "dueDate": "2026-06-14",
      "eventId": "cuid",
      "yearMonth": null,
      "paidCount": 22,
      "waivedCount": 2,
      "totalCount": 28,
      "createdAt": "2026-06-14T14:00:00+09:00"
    }
  ]
}
```

---

<a id="collections-create"></a>

### POST `/api/v1/:orgSlug/finance/collections`

徴収を手動作成する。作成と同時に全アクティブ団員の CollectionPayment（`pending`）が自動生成される。

**権限**: `finance+`

**Request Body:**

```json
{
  "title": "6月合宿費",
  "amount": 15000,
  "dueDate": "2026-07-01",
  "eventId": null,
  "yearMonth": null,
  "scoreId": null,
  "note": ""
}
```

> `scoreId` を指定すると楽譜詳細画面から「徴収作成済み」と判定できる。楽譜詳細画面から作成した場合は自動でセットされる。

**Response** `201` → 作成した Collection（payments の件数含む）

---

<a id="collections-id-get"></a>

### GET `/api/v1/:orgSlug/finance/collections/:id`

徴収詳細と全団員の支払い状況を取得する。

**権限**: `finance+`

**Response** `200`

```json
{
  "data": {
    "id": "cuid",
    "title": "6/14練習 場所代",
    "amount": 300,
    "dueDate": "2026-06-14",
    "payments": [
      {
        "memberId": "cuid",
        "memberName": "山田 太郎",
        "partName": "Tenor I",
        "status": "paid",
        "amount": 300,
        "paidAt": "2026-06-14",
        "method": "paypay",
        "note": null
      },
      {
        "memberId": "cuid",
        "memberName": "鈴木 花子",
        "partName": "Tenor II",
        "status": "pending",
        "amount": null,
        "paidAt": null,
        "method": null,
        "note": null
      }
    ]
  }
}
```

---

<a id="collections-id-delete"></a>

### DELETE `/api/v1/:orgSlug/finance/collections/:id`

徴収と紐付く CollectionPayment を全件削除する。

**権限**: `finance+`

**Response** `204` No Content

---

<a id="collection-payment-patch"></a>

### PATCH `/api/v1/:orgSlug/finance/collections/:id/payments/:memberId`

団員の支払い状況を更新する。

**権限**: `finance+`

**Request Body:**

```json
{
  "status": "paid",
  "amount": 300,
  "paidAt": "2026-06-14",
  "method": "cash",
  "note": null
}
```

| フィールド | 型     | 必須 | 説明                                          |
| ---------- | ------ | ---- | --------------------------------------------- |
| status     | string | ✓    | `pending` / `paid` / `waived`                 |
| amount     | number |      | `paid` 時に設定（省略時 Collection.amount）   |
| paidAt     | string |      | `paid` 時に設定（省略時 今日）                |
| method     | string |      | `cash` / `paypay` / `bank_transfer` / `other` |
| note       | string |      | 備考                                          |

**Response** `200` → 更新後の CollectionPayment

---

### 11.4 支出

<a id="expenses-list"></a>

### GET `/api/v1/:orgSlug/finance/expenses`

支出一覧を取得する。

**権限**: `finance+`

**Query Parameters:**

| パラメータ | 型     | 説明                                                       |
| ---------- | ------ | ---------------------------------------------------------- |
| from       | string | 開始日フィルタ（ISO8601）paidAt: null の支出も常に含まれる |
| to         | string | 終了日フィルタ（ISO8601）                                  |
| categoryId | string | カテゴリフィルタ                                           |

**Response** `200`

```json
{
  "data": [
    {
      "id": "cuid",
      "category": { "id": "cuid", "name": "会場費" },
      "title": "市民会館 第2練習室 6/14",
      "amount": 8000,
      "paymentMethod": "bank_transfer",
      "paidAt": "2026-06-14T00:00:00.000Z",
      "eventId": "cuid",
      "note": null,
      "createdAt": "2026-06-01T00:00:00.000Z"
    }
  ]
}
```

---

<a id="expenses-create"></a>

### POST `/api/v1/:orgSlug/finance/expenses`

支出を登録する。

**権限**: `finance+`

**Request Body:**

```json
{
  "title": "市民会館 第2練習室 6/14",
  "categoryId": "cuid",
  "amount": 8000,
  "paymentMethod": "bank_transfer",
  "paidAt": "2026-06-14",
  "eventId": null,
  "note": null
}
```

**Response** `201` → 作成した Expense

---

<a id="expenses-patch"></a>

### PATCH `/api/v1/:orgSlug/finance/expenses/:id`

支出を更新する。全フィールド省略可。

**権限**: `finance+`

**Response** `200` → 更新後の Expense

---

<a id="expenses-delete"></a>

### DELETE `/api/v1/:orgSlug/finance/expenses/:id`

支出を削除する。

**権限**: `finance+`

**Response** `204` No Content

---

## 12. 情宣活動 API

<a id="outreach-list"></a>

### GET `/api/v1/:orgSlug/tickets/:concertId/outreach`

演奏会に紐づく情宣活動一覧を取得する。

**権限**: `member+`（自身が申請/参加したもののみ返却。admin/ticket は全件返却）

**Response** `200`

```json
{
  "data": [
    {
      "id": "string",
      "concertId": "string",
      "destination": "渋谷駅前",
      "activityDate": "2026-05-10T00:00:00.000Z",
      "note": "string | null",
      "status": "pending | paid",
      "paidAt": "string | null",
      "createdBy": "string",
      "creatorName": "string",
      "createdAt": "string",
      "participants": [
        {
          "id": "string",
          "memberId": "string",
          "memberName": "string",
          "partId": "string | null",
          "partName": "string | null",
          "ticketsSold": 3,
          "expense": 500
        }
      ]
    }
  ]
}
```

---

<a id="outreach-create"></a>

### POST `/api/v1/:orgSlug/tickets/:concertId/outreach`

情宣活動を申請する。

**権限**: `member+`

**Request Body:**

```json
{
  "destination": "渋谷駅前",
  "activityDate": "2026-05-10",
  "note": "optional",
  "participants": [
    {
      "memberId": "string",
      "ticketsSold": 3,
      "expense": 500
    }
  ]
}
```

**Response** `201` 作成した活動オブジェクト

---

<a id="outreach-pay"></a>

### PATCH `/api/v1/:orgSlug/tickets/:concertId/outreach/:activityId/pay`

情宣活動の交通費を支払済みにする。

**権限**: `ticket` ロールまたは `admin`

**Response** `200` 更新後の活動オブジェクト

---

<a id="outreach-delete"></a>

### DELETE `/api/v1/:orgSlug/tickets/:concertId/outreach/:activityId`

情宣活動を削除する。

**権限**: 申請者本人または `ticket+` / `admin`

**Response** `204` No Content

---
