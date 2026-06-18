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
const timeOf = (s: string) => (s.includes("T") ? s.slice(11, 16) : "");

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

function nearestDay(items: Item[], today: string): Item[] {
  const future = items.filter((i) => i.day >= today);
  if (!future.length) return [];
  const min = future.reduce((a, b) => (a.day < b.day ? a : b)).day;
  return future.filter((i) => i.day === min);
}

// 「選　考｜6/21 サントリー・Webテスト」形式(カテゴリ｜日付 企業・ラベル)
function fmtItem(cat: string, it: Item): string {
  const mo = Number(it.day.slice(5, 7));
  const da = Number(it.day.slice(8, 10));
  const t = timeOf(it.date);
  const when = `${mo}/${da}${t ? " " + t : ""}`;
  return `${cat}｜${when} ${it.company}・${it.label}`;
}

function buildPayload(
  apps: any[],
  events: any[],
  notify: any,
  today: string,
): { title: string; body: string; url: string } | null {
  const sel = collectSteps(apps, today);
  const ev = collectEvents(events, today);
  let selPick: Item[] = [];
  let evPick: Item[] = [];

  if (notify.mode === "lead") {
    const days: string[] = (notify.leadDays ?? [1]).map((n: number) =>
      addDays(today, n),
    );
    selPick = sel.filter((i) => days.includes(i.day));
    evPick = ev.filter((i) => days.includes(i.day));
  } else {
    // morning: 各カテゴリの「一番近い日」の全件
    selPick = nearestDay(sel, today);
    evPick = nearestDay(ev, today);
  }

  if (!selPick.length && !evPick.length) return null;

  // 1件1行: 「選　考｜…」「イベント｜…」(選考を全角空白で詰めて｜を揃える)
  const lines: string[] = [];
  for (const it of selPick) lines.push(fmtItem("選　考", it));
  for (const it of evPick) lines.push(fmtItem("イベント", it));

  // iOS が上にアプリ名「就活 Hub」を出すので、タイトルに名前は入れない(重複回避)
  const title = notify.mode === "lead" ? "まもなくの予定" : "直近の予定";
  return { title, body: lines.join("\n"), url: "/" };
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

    const payload = buildPayload(d.applications, d.events, notify, today);
    if (!payload) continue;
    users++;

    for (const sub of subs) {
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

  return new Response(JSON.stringify({ today, users, sent, failed }), {
    headers: { "content-type": "application/json" },
  });
});
