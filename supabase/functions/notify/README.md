# 通知配信 (notify) のデプロイ手順

毎朝 cron から叩かれ、通知ONのユーザーへ Web Push を送る Edge Function。

## 1. シークレットを設定

VAPID 鍵はアプリ生成時のものを使う（公開鍵はクライアント `src/lib/constants.ts` に埋め込み済み）。
**秘密鍵はここ(Supabase secrets)にだけ置く。Git やフロントには絶対に置かない。**

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="BKjWhLJJ3cgX3x0UCyoOxHkEVZdV6TiZ_95IOxKyAQk_cb1oyyai0H23hb7AgEPw5GAcG-EI3qKccWmvL7d7D2k" \
  VAPID_PRIVATE_KEY="<秘密鍵 — 別途共有>" \
  VAPID_SUBJECT="mailto:notify@example.com" \
  CRON_SECRET="<好きなランダム文字列>"
```

`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` は Edge Function 実行時に自動で入るので設定不要。

## 2. デプロイ

cron(サーバー間)から叩くので JWT 検証は切る。

```bash
supabase functions deploy notify --no-verify-jwt
```

## 3. 動作確認（手動で1回叩く）

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/notify" \
  -H "Authorization: Bearer <CRON_SECRET>"
# => {"today":"2026-06-18","users":N,"sent":M,"failed":0}
```

## 4. スケジュール (pg_cron + pg_net)

通知時刻はユーザーが個別に設定する(6〜23時)ので、cron は**毎時0分**に回し、
関数内で「各ユーザーの設定時刻(JST)に一致した回だけ送る」。

SQL エディタで拡張を有効化してから登録する。

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'shukatsu-notify-hourly',
  '0 * * * *',  -- 毎時0分(UTC)。関数が各ユーザーの設定時刻(JST)を見て出し分ける
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

解除するとき:

```sql
select cron.unschedule('shukatsu-notify-hourly');
```

## 配信ロジック（index.ts と対応）

- 各ユーザーの `data.notify.enabled` が true の人だけが対象
- `data.pushSubscriptions`（端末ごと）全てに送る
- `morning`: 選考の一番近い日の全件 ＋ イベントの一番近い日の全件
- `lead`: `leadDays`(例 [3,1]) の各日数後ちょうどに該当する選考・イベント
- 締切は `focusDate`（締切優先・消化/超過で実施日へ）で判定。完了/参加済みは除外
- 該当ゼロのユーザーには送らない

## 補足（今後の改善余地）

- 送信失敗(404/410)の購読は失効。本来は `user_data` から取り除くべき（今はログのみ）
- 通知時刻は当面 8:00 固定（cron が JST8時相当の1本）。ユーザー個別時刻にするなら cron を増やすか関数内で hour を見て出し分け
