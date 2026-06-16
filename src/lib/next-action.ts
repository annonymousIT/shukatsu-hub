import type { Application, SelectionStep, Situation } from "./types";
import { dueInstant, isDueThisWeekOrOverdue } from "./date";

const NO_DUE_KEY = Number.MAX_SAFE_INTEGER;
const TERMINAL_KEY = Number.POSITIVE_INFINITY;

export type NextActionType = "step" | "waiting" | "empty" | "result";

export interface NextAction {
  type: NextActionType;
  step: SelectionStep | null;
  sortKey: number;
}

/** 未完了(完了以外)のステップ一覧 */
export function incompleteSteps(app: Application): SelectionStep[] {
  return app.steps.filter((s) => s.status !== "done");
}

/** 未完了の中から「最も締切が近い」ステップ。締切ありを優先、無ければ並び順で最初。 */
export function getNextActionStep(app: Application): SelectionStep | null {
  const incomplete = incompleteSteps(app);
  if (incomplete.length === 0) return null;
  const withDue = incomplete
    .filter((s) => s.dueAt)
    .sort((a, b) => (dueInstant(a.dueAt) ?? 0) - (dueInstant(b.dueAt) ?? 0));
  if (withDue.length > 0) return withDue[0];
  return incomplete[0];
}

/**
 * 一覧で主役になる「次のアクション」。
 * - 結果が出ている → "result"
 * - 進行中 & 次が結果待ちステップ / 全完了 → "waiting"
 * - 進行中 & 次にやるステップあり → "step"
 * - 進行中 & ステップ未登録 → "empty"
 */
export function getNextAction(app: Application): NextAction {
  if (app.result !== "in_progress") {
    return { type: "result", step: null, sortKey: TERMINAL_KEY };
  }
  if (app.steps.length === 0) {
    return { type: "empty", step: null, sortKey: TERMINAL_KEY };
  }
  const step = getNextActionStep(app);
  if (!step) {
    return { type: "waiting", step: null, sortKey: TERMINAL_KEY };
  }
  const sortKey = step.dueAt ? (dueInstant(step.dueAt) ?? NO_DUE_KEY) : NO_DUE_KEY;
  if (step.status === "waiting") {
    // 結果待ちは締切ソートから除外し、進行中の後ろへ寄せる。
    // dueAt は保持しているので、状態を戻せば自動で締切順に復帰する。
    return { type: "waiting", step, sortKey: NO_DUE_KEY };
  }
  return { type: "step", step, sortKey };
}

/** 状況分類(フィルタ・バッジ用) */
export function situationOf(app: Application): Situation {
  if (app.result === "passed") return "passed";
  if (app.result === "rejected") return "rejected";
  if (app.result === "declined") return "declined";
  const step = getNextActionStep(app);
  if (!step) return "waiting"; // 全ステップ完了で結果待ち
  if (step.status === "waiting") return "waiting";
  return "in_progress";
}

// ---- 進捗トラック(ダッシュボードのゲージ) ----

export type SegState =
  | "done" // 通過(フル・色)
  | "current" // 進行中(半分)
  | "next" // 着手前の現在地(空に近い)
  | "waiting" // 結果待ち(フル・灰)
  | "empty" // 未到達
  | "failed" // 不合格で落ちた/通ってきた段(フル・赤)
  | "declined"; // 辞退(フル・灰)

export interface Segment {
  step: SelectionStep;
  state: SegState;
}

export function trackSegments(app: Application): Segment[] {
  const currentId = getNextActionStep(app)?.id ?? null;
  return app.steps.map((s) => {
    if (app.result === "rejected") {
      if (s.status === "done" || s.id === currentId)
        return { step: s, state: "failed" as SegState };
      return { step: s, state: "empty" as SegState };
    }
    if (app.result === "declined") {
      if (s.status === "done" || s.id === currentId)
        return { step: s, state: "declined" as SegState };
      return { step: s, state: "empty" as SegState };
    }
    // in_progress / passed
    if (s.status === "done") return { step: s, state: "done" as SegState };
    if (s.status === "waiting") return { step: s, state: "waiting" as SegState };
    if (s.id === currentId)
      return {
        step: s,
        state: (s.status === "in_progress" ? "current" : "next") as SegState,
      };
    return { step: s, state: "empty" as SegState };
  });
}

/** 完了ステップ数 / 全ステップ数 */
export function stepProgress(app: Application): { done: number; total: number } {
  return {
    done: app.steps.filter((s) => s.status === "done").length,
    total: app.steps.length,
  };
}

/** 今週やるべき(今週締切 or 期限切れ)未完了ステップ数 */
export function thisWeekTaskCount(app: Application): number {
  if (app.result !== "in_progress") return 0;
  return app.steps.filter(
    (s) => s.status !== "done" && s.dueAt && isDueThisWeekOrOverdue(s.dueAt),
  ).length;
}

export function hasThisWeekTask(app: Application): boolean {
  return thisWeekTaskCount(app) > 0;
}
