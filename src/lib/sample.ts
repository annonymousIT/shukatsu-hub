// 初回チュートリアル用のサンプル企業を生成する。
// 新規(データ空)ユーザーにだけ投入され、チュートリアル終了で自動削除される。
import type { Application } from "./types";
import { normalizeApps } from "./io";
import { SAMPLE_APP_ID } from "./constants";

/** 今日からの相対日を "YYYY-MM-DD" で返す */
function dPlus(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * チュートリアルを成立させるためのサンプル1社。
 * - ステップの状態を散らして進捗ゲージ・status-dot 解説が機能するように
 * - 次アクションが ES(進行中・2日後) になるよう dueAt を設定
 * - 選考種別=短期インターンで開催地が出る / ES設問とリンクも1件ずつ
 */
export function buildSampleApplications(): Application[] {
  const now = new Date().toISOString();
  const app: Application = {
    id: SAMPLE_APP_ID,
    company: "（サンプル）ANIT商事",
    role: "サマーインターン（PdMコース）",
    priority: "high",
    result: "in_progress",
    selectionType: "short_intern",
    venueMode: "onsite",
    venuePlace: "東京・渋谷",
    links: [
      {
        id: `${SAMPLE_APP_ID}-l1`,
        label: "マイページ（例）",
        url: "https://example.com",
      },
    ],
    esEntries: [
      {
        id: `${SAMPLE_APP_ID}-e1`,
        question: "学生時代に力を入れたこと（400字）",
        answer: "ここに回答を書いて保存しておくと、提出時にコピーして使い回せます。",
        charLimit: 400,
      },
    ],
    memo: "これは使い方を体験するためのサンプルです。チュートリアルが終わると自動で消えます。",
    steps: [
      { id: `${SAMPLE_APP_ID}-s1`, kind: "entry", name: "エントリー", dueAt: dPlus(0), status: "done", location: "", memo: "" },
      { id: `${SAMPLE_APP_ID}-s2`, kind: "es", name: "ES提出", dueAt: dPlus(2), status: "in_progress", location: "", memo: "丸をタップで状態を切り替えられます" },
      { id: `${SAMPLE_APP_ID}-s3`, kind: "web_test", name: "Webテスト", dueAt: dPlus(5), status: "not_started", location: "", memo: "" },
      { id: `${SAMPLE_APP_ID}-s4`, kind: "interview", name: "面接", dueAt: dPlus(9), status: "not_started", location: "オンライン", memo: "" },
      { id: `${SAMPLE_APP_ID}-s5`, kind: "internship", name: "インターン参加", dueAt: dPlus(14), status: "not_started", location: "", memo: "" },
    ],
    createdAt: now,
    updatedAt: now,
  };
  // 欠損補完・型整合を保証
  return normalizeApps([app]);
}
