// 就活Hub 通知配信 (Supabase Edge Function / Deno)
// 毎朝 cron から叩かれ、通知ON のユーザーへ Web Push を送る。
// 秘密鍵は Supabase secrets にのみ置く(コードには公開鍵すら書かない)。
//
// 必要な secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (関数に自動付与される場合あり)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT(mailto:...)
//   CRON_SECRET (cron からの呼び出しを認証する任意の文字列)

import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:notify@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const KIND_LABEL: Record<string, string> = {
  entry: "エントリー",
  es: "ES提出",
  web_test: "Webテスト",
  video: "録画動画",
  gd: "GD",
  interview: "面接",
  final_interview: "最終面接",
  internship: "インターン参加",
  other: "その他",
};

const dateOnly = (s: string) => s.slice(0, 10);

function jstToday(): string {
  const now = new Date();
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function jstHour(): number {
  const now = new Date();
  return new Date(now.getTime() + 9 * 3600 * 1000).getUTCHours();
}

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// アプリの focusOf と同じ考え方: 締切優先・消化/超過で実施日へ
function focusDate(
  due: string | null,
  held: string | null,
  done: boolean | undefined,
  today: string,
): string | null {
  if (due && !done) {
    if (held && dateOnly(due) < today) return held;
    return due;
  }
  return held ?? null;
}

interface Item {
  company: string;
  label: string;
  day: string;
  date: string;
}

function collectSteps(apps: any[], today: string): Item[] {
  const out: Item[] = [];
  for (const app of apps ?? []) {
    const stages = app.stages;
    if (Array.isArray(stages) && stages.length) {
      // 新モデル(段階＞タスク)
      for (const st of stages) {
        // 決着した段階(通過/不合格/辞退)はスキップ
        if (
          st.result === "passed" ||
          st.result === "failed" ||
          st.result === "declined"
        ) {
          continue;
        }
        for (const t of st.tasks ?? []) {
          const fd = focusDate(t.dueAt, t.heldAt, t.done, today);
          if (!fd) continue;
          out.push({
            company: app.company || "(企業未設定)",
            label: KIND_LABEL[t.kind] ?? "予定",
            day: dateOnly(fd),
            date: fd,
          });
        }
      }
    } else {
      // 旧モデル(移行前データ)へのフォールバック
      for (const s of app.steps ?? []) {
        if (s.status === "done") continue;
        const fd = focusDate(s.dueAt, s.heldAt, s.dueDone, today);
        if (!fd) continue;
        out.push({
          company: app.company || "(企業未設定)",
          label: KIND_LABEL[s.kind] ?? "予定",
          day: dateOnly(fd),
          date: fd,
        });
      }
    }
  }
  return out;
}

function collectEvents(events: any[], today: string): Item[] {
  const out: Item[] = [];
  for (const ev of events ?? []) {
    // 参加済/辞退はスキップ(todo のみ通知)
    if (ev.status !== "todo") continue;
    const fd = focusDate(ev.applyBy, ev.heldAt, ev.applyDone, today);
    if (!fd) continue;
    out.push({
      company: ev.company || ev.title || "(イベント)",
      label: ev.title || "イベント",
      day: dateOnly(fd),
      date: fd,
    });
  }
  return out;
}

const WD_JP = ["日", "月", "火", "水", "木", "金", "土"];

// 「6/21 土｜サントリー・Webテスト」形式(選考/イベント混在・カテゴリ無し)
function fmtItem(it: Item): string {
  const mo = Number(it.day.slice(5, 7));
  const da = Number(it.day.slice(8, 10));
  const wd = WD_JP[new Date(it.day + "T00:00:00Z").getUTCDay()];
  return `${mo}/${da} ${wd}｜${it.company}・${it.label}`;
}

type Payload = { title: string; body: string; url: string; badge?: number };

// 選考・イベントを混ぜて、通知を組み立てる(複数返ることがある=lead で日数ごと)
function buildPayloads(
  apps: any[],
  events: any[],
  notify: any,
  today: string,
): Payload[] {
  // 混ぜて未来分のみ・日付(時刻含む)順に
  const all = [...collectSteps(apps, today), ...collectEvents(events, today)]
    .filter((i) => i.day >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!all.length) return [];

  // アプリアイコンの赤バッジ用: 直近1週間以内の件数(アプリ内の集計と一致させる)
  const weekLimit = addDays(today, 7);
  const badge = all.filter((i) => i.day <= weekLimit).length;

  if (notify.mode === "lead") {
    // N日前ちょうどの予定。日数ごとに別通知(同日複数あれば複数行)
    const out: Payload[] = [];
    const leadDays: number[] = notify.leadDays ?? [1];
    for (const n of [...leadDays].sort((a, b) => a - b)) {
      const target = addDays(today, n);
      const items = all.filter((i) => i.day === target);
      if (!items.length) continue;
      const title = n === 1 ? "就活Hub｜前日通知" : `就活Hub｜${n}日前通知`;
      out.push({ title, body: items.map(fmtItem).join("\n"), url: "/", badge });
    }
    return out;
  }

  // morning: 最も近い「2日分」の予定(同日複数OK)
  const days: string[] = [];
  for (const i of all) {
    if (!days.includes(i.day)) days.push(i.day);
    if (days.length >= 2) break;
  }
  const items = all.filter((i) => days.includes(i.day));
  return [
    { title: "就活Hub｜直近の予定", body: items.map(fmtItem).join("\n"), url: "/", badge },
  ];
}

Deno.serve(async (req) => {
  // cron からの呼び出しを認証
  const secret = Deno.env.get("CRON_SECRET");
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  // body オプション(手動テスト用):
  //   {"force":true}      … 時刻ゲートを無視して即送信
  //   {"userId":"<uuid>"} … その1ユーザーだけに限定(他人に飛ばさない)
  let force = false;
  let onlyUser: string | null = null;
  try {
    const body = await req.json();
    force = body?.force === true || body?.test === true;
    if (typeof body?.userId === "string" && body.userId) onlyUser = body.userId;
  } catch {
    // body 無し/JSON でない → 通常実行
  }

  const today = jstToday();
  const hour = jstHour();
  const { data: rows, error } = await supabase
    .from("user_data")
    .select("user_id, data");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  let users = 0;
  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    // userId 指定があればその人だけ(手動テストで他人に飛ばさない)
    if (onlyUser && (row as any).user_id !== onlyUser) continue;
    const d = (row as any).data ?? {};
    const notify = d.notify;
    if (!notify?.enabled) continue;
    // ユーザーが設定した時刻(JST)の回だけ送る(force 時は無視)
    const userHour = typeof notify.hour === "number" ? notify.hour : 8;
    if (!force && userHour !== hour) continue;
    const subs: any[] = d.pushSubscriptions ?? [];
    if (!subs.length) continue;

    const payloads = buildPayloads(d.applications, d.events, notify, today);
    if (!payloads.length) continue;
    users++;

    for (const sub of subs) {
      for (const payload of payloads) {
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload));
          sent++;
        } catch (e) {
          failed++;
          // 404/410 は失効購読。本番では user_data から取り除くと良い。
          console.error("push failed:", (e as any)?.statusCode ?? e);
        }
      }
    }
  }

  return new Response(JSON.stringify({ today, users, sent, failed }), {
    headers: { "content-type": "application/json" },
  });
});
