import type {
  Application,
  EventItem,
  ResultStatus,
  SelectionStage,
  SelectionStep,
  SelectionTask,
  Situation,
  StepKind,
} from "./types";
import { dueInstant, isDueThisWeekOrOverdue } from "./date";

/** イベントが完了扱いか(参加済/辞退を選んだ、または開催日が過ぎた)。状態自体は書き換えない。 */
export function isEventDone(ev: EventItem): boolean {
  if (ev.status !== "todo") return true;
  if (ev.heldAt) {
    const inst = dueInstant(ev.heldAt);
    if (inst != null && inst < Date.now()) return true;
  }
  return false;
}

const NO_DUE_KEY = Number.MAX_SAFE_INTEGER;
const TERMINAL_KEY = Number.POSITIVE_INFINITY;

export type NextActionType = "step" | "waiting" | "empty" | "result";

export type FocusKind = "deadline" | "held";

export interface NextAction {
  type: NextActionType;
  step: SelectionStep | null;
  sortKey: number;
  /** 注目日(締切を優先、無ければ実施日)。表示・ハイライトに使う */
  focusDate: string | null;
  /** 注目日が締切か実施日か */
  focusKind: FocusKind | null;
}

export interface FocusResult {
  date: string | null;
  kind: FocusKind | null;
}

/**
 * 締切(due)/実施・開催(held)/消化フラグ(done)から「注目日」と種別を算出(選考・イベント共通)。
 * 締切が未消化かつ未来なら締切が注目。消化済み(提出・予約・申込)or 超過なら実施/開催日へ移る。
 */
export function focusOf(
  due: string | null,
  held: string | null,
  done?: boolean,
): FocusResult {
  if (due && !done) {
    const inst = dueInstant(due);
    if (inst !== null && inst < Date.now() && held) {
      return { date: held, kind: "held" };
    }
    return { date: due, kind: "deadline" };
  }
  return { date: held, kind: held ? "held" : null };
}

/** ステップの注目日(締切優先・消化/超過で実施日へ) */
export function stepFocusDate(s: SelectionStep): string | null {
  return focusOf(s.dueAt, s.heldAt, s.dueDone).date;
}

/** 注目日が締切か実施日か */
export function stepFocusKind(s: SelectionStep): FocusKind | null {
  return focusOf(s.dueAt, s.heldAt, s.dueDone).kind;
}

/** 未完了(完了以外)のステップ一覧 */
export function incompleteSteps(app: Application): SelectionStep[] {
  return app.steps.filter((s) => s.status !== "done");
}

/** 未完了の中から「最も締切が近い」ステップ。締切ありを優先、無ければ並び順で最初。 */
export function getNextActionStep(app: Application): SelectionStep | null {
  const incomplete = incompleteSteps(app);
  if (incomplete.length === 0) return null;
  const withDate = incomplete
    .filter((s) => stepFocusDate(s))
    .sort(
      (a, b) =>
        (dueInstant(stepFocusDate(a)) ?? 0) -
        (dueInstant(stepFocusDate(b)) ?? 0),
    );
  if (withDate.length > 0) return withDate[0];
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
    return {
      type: "result",
      step: null,
      sortKey: TERMINAL_KEY,
      focusDate: null,
      focusKind: null,
    };
  }
  if (app.steps.length === 0) {
    return {
      type: "empty",
      step: null,
      sortKey: TERMINAL_KEY,
      focusDate: null,
      focusKind: null,
    };
  }
  const step = getNextActionStep(app);
  if (!step) {
    return {
      type: "waiting",
      step: null,
      sortKey: TERMINAL_KEY,
      focusDate: null,
      focusKind: null,
    };
  }
  const fd = stepFocusDate(step);
  const fk = stepFocusKind(step);
  const sortKey = fd ? (dueInstant(fd) ?? NO_DUE_KEY) : NO_DUE_KEY;
  if (step.status === "waiting") {
    // 結果待ちは締切ソートから除外し、進行中の後ろへ寄せる。
    return {
      type: "waiting",
      step,
      sortKey: NO_DUE_KEY,
      focusDate: fd,
      focusKind: fk,
    };
  }
  return { type: "step", step, sortKey, focusDate: fd, focusKind: fk };
}

/** 状況分類(フィルタ・バッジ用)。passed/rejected/declined は app.result(段階から同期)、結果待ちは段階から判定。 */
export function situationOf(app: Application): Situation {
  if (app.result === "passed") return "passed";
  if (app.result === "rejected") return "rejected";
  if (app.result === "declined") return "declined";
  const stage = currentStage(app);
  if (!stage) return "in_progress";
  // 現在段階の全タスクをやった(結果待ち) or 段階を明示的に結果待ちにした
  if (stage.result === "waiting") return "waiting";
  if (stage.tasks.length > 0 && stage.tasks.every((t) => t.done)) return "waiting";
  return "in_progress";
}

// ---- 進捗トラック(ダッシュボードのゲージ) ----

export type SegState =
  | "done" // 通過(フル・色)
  | "current" // 進行中(半分)
  | "next" // 着手前の現在地(空に近い)
  | "waiting" // 結果待ち(べた塗り＋境界に砂時計マーク=審査中)
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

// ============================================================
// 段階 ＞ タスク (新モデル)
// ============================================================

/** タスクの注目日(締切優先・提出済/超過で実施日へ) */
export function taskFocusDate(t: SelectionTask): string | null {
  return focusOf(t.dueAt, t.heldAt, t.submitted ?? t.done).date;
}

/** タスクの注目日が締切か実施日か */
export function taskFocusKind(t: SelectionTask): FocusKind | null {
  return focusOf(t.dueAt, t.heldAt, t.submitted ?? t.done).kind;
}

/** 現在の段階の表示名(段階名 or 先頭タスクの種別)。結果待ち表示などに使う。 */
export function currentStageLabel(app: Application): string {
  const s = currentStage(app);
  if (!s) return "";
  return s.label.trim() || (s.tasks[0] ? KIND_LABEL_SHORT[s.tasks[0].kind] : "");
}

const KIND_LABEL_SHORT: Record<SelectionTask["kind"], string> = {
  entry: "エントリー",
  es: "ES",
  web_test: "Webテスト",
  video: "録画",
  gd: "GD",
  interview: "面接",
  final_interview: "最終面接",
  internship: "インターン",
  other: "選考",
};

/** 段階が決着済み(通過/不合格/辞退)か */
export function isStageSettled(s: SelectionStage): boolean {
  return (
    s.result === "passed" || s.result === "failed" || s.result === "declined"
  );
}

/** 現在の段階 = 先頭から最初の未決着(未/結果待ち)段階。全段階決着なら null。 */
export function currentStage(app: Application): SelectionStage | null {
  return app.stages.find((s) => !isStageSettled(s)) ?? null;
}

/** stages から全体結果を導出。不合格/辞退は段階優先、全段階通過で合格。 */
export function deriveResult(stages: SelectionStage[]): ResultStatus {
  if (stages.some((s) => s.result === "failed")) return "rejected";
  if (stages.some((s) => s.result === "declined")) return "declined";
  if (stages.length > 0 && stages.every((s) => s.result === "passed"))
    return "passed";
  return "in_progress";
}

/** 今やるべきタスク(現在段階の未done)。並行なら複数返る(取りこぼし防止)。 */
export function nextTasks(app: Application): SelectionTask[] {
  const stage = currentStage(app);
  if (!stage) return [];
  return stage.tasks.filter((t) => !t.done);
}

/** 段階版の「次のアクション」。card の主役表示用(tasks=並行可)。 */
export interface StageNextAction {
  type: NextActionType;
  /** 次にやるタスク(並行=複数)。waiting/result/empty では空配列 */
  tasks: SelectionTask[];
  sortKey: number;
  /** 代表(最も締切が近い)タスクの注目日 */
  focusDate: string | null;
  focusKind: FocusKind | null;
}

export function getStageNextAction(app: Application): StageNextAction {
  if (app.result !== "in_progress") {
    return {
      type: "result",
      tasks: [],
      sortKey: TERMINAL_KEY,
      focusDate: null,
      focusKind: null,
    };
  }
  if (app.stages.length === 0) {
    return {
      type: "empty",
      tasks: [],
      sortKey: TERMINAL_KEY,
      focusDate: null,
      focusKind: null,
    };
  }
  const tasks = nextTasks(app);
  if (tasks.length === 0) {
    // 現在段階の全タスクをやった(結果待ち) or 全段階決着
    return {
      type: "waiting",
      tasks: [],
      sortKey: NO_DUE_KEY,
      focusDate: null,
      focusKind: null,
    };
  }
  // 締切が近い順に並べ、代表(先頭)を sortKey/ハイライトに使う
  const sorted = [...tasks].sort(
    (a, b) =>
      (dueInstant(taskFocusDate(a)) ?? NO_DUE_KEY) -
      (dueInstant(taskFocusDate(b)) ?? NO_DUE_KEY),
  );
  const lead = sorted[0];
  const fd = taskFocusDate(lead);
  const fk = taskFocusKind(lead);
  const sortKey = fd ? (dueInstant(fd) ?? NO_DUE_KEY) : NO_DUE_KEY;
  return { type: "step", tasks: sorted, sortKey, focusDate: fd, focusKind: fk };
}

// ---- 進捗トラック(段階セグメント) ----

export type StageSegState =
  | "passed" // 通過(緑)
  | "current" // 現在地(着手中・灰の強調)
  | "waiting" // やった・結果待ち(黄)
  | "empty" // 未到達(灰)
  | "failed" // 不合格(赤)
  | "declined"; // 辞退(灰)

export interface StageSegment {
  stage: SelectionStage;
  state: StageSegState;
}

export function stageSegments(app: Application): StageSegment[] {
  const curId = currentStage(app)?.id ?? null;
  return app.stages.map((s) => {
    if (s.result === "passed") return { stage: s, state: "passed" as const };
    if (s.result === "failed") return { stage: s, state: "failed" as const };
    if (s.result === "declined")
      return { stage: s, state: "declined" as const };
    // pending / waiting
    const allDone = s.tasks.length > 0 && s.tasks.every((t) => t.done);
    if (s.result === "waiting" || (s.id === curId && allDone))
      return { stage: s, state: "waiting" as const };
    if (s.id === curId) return { stage: s, state: "current" as const };
    return { stage: s, state: "empty" as const };
  });
}

/** 通過した段階数 / 全段階数 */
export function stageProgress(app: Application): {
  done: number;
  total: number;
} {
  return {
    done: app.stages.filter((s) => s.result === "passed").length,
    total: app.stages.length,
  };
}

/** 今週やるべき(今週締切 or 期限切れ)未doneタスク数(段階版) */
export function thisWeekStageTaskCount(app: Application): number {
  if (app.result !== "in_progress") return 0;
  let n = 0;
  for (const s of app.stages) {
    if (isStageSettled(s)) continue;
    for (const t of s.tasks) {
      if (!t.done && t.dueAt && isDueThisWeekOrOverdue(t.dueAt)) n++;
    }
  }
  return n;
}

export function hasThisWeekStageTask(app: Application): boolean {
  return thisWeekStageTaskCount(app) > 0;
}

// ---- 努力サマリー(積み上げ): 全社の「やった」タスクを種別グループで集計 ----

const DOC_KINDS: StepKind[] = ["es"];
const WEBTEST_KINDS: StepKind[] = ["web_test"];
const INTERVIEW_KINDS: StepKind[] = [
  "gd",
  "interview",
  "final_interview",
  "video",
];

export interface EffortSummary {
  /** 書類(ES提出)をやった数 */
  docs: number;
  /** Webテストをやった数 */
  webtest: number;
  /** 面接/GD(録画含む)をやった数 */
  interview: number;
}

/** 全社のやったタスクを「書類/Webテスト/面接GD」で数える(結果に関わらず=努力そのもの) */
export function effortSummary(apps: Application[]): EffortSummary {
  let docs = 0;
  let webtest = 0;
  let interview = 0;
  for (const app of apps) {
    for (const st of app.stages) {
      for (const t of st.tasks) {
        if (!t.done) continue;
        if (DOC_KINDS.includes(t.kind)) docs++;
        else if (WEBTEST_KINDS.includes(t.kind)) webtest++;
        else if (INTERVIEW_KINDS.includes(t.kind)) interview++;
      }
    }
  }
  return { docs, webtest, interview };
}

/** ローカル基準の年月日キー(updatedAt と today を同じ基準で比較する用) */
function localDayKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * 「今日 合格(内定/内々定/参加確定)になった社」を返す。終日その日だけ祝う用。
 * result(段階から導出) と 更新日 から毎回算出する(独立フラグは持たない=取り消しは自動で吸収)。
 * 途中の段階通過はスルー(全体結果が passed の社のみ)。
 */
export function passedToday(apps: Application[]): Application[] {
  const todayKey = localDayKey(new Date());
  return apps.filter(
    (a) =>
      a.result === "passed" &&
      localDayKey(new Date(a.updatedAt)) === todayKey,
  );
}

/**
 * アプリアイコンの赤バッジに出す件数。
 * = 直近1週間以内(締切超過分を含む)の、未完了の選考タスク＋イベント。
 * ホーム上部の「直近1週間の予定」バナー(選考＋イベント)の合計と一致させる。
 */
export function badgeCount(apps: Application[], events: EventItem[]): number {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lim = new Date();
  lim.setDate(lim.getDate() + 7);
  const limitKey = `${lim.getFullYear()}-${pad(lim.getMonth() + 1)}-${pad(lim.getDate())}`;
  let count = 0;
  for (const app of apps) {
    const na = getStageNextAction(app);
    if (
      na.type === "step" &&
      na.focusDate &&
      na.focusDate.slice(0, 10) <= limitKey &&
      dueInstant(na.focusDate) != null
    ) {
      count++;
    }
  }
  for (const ev of events) {
    if (isEventDone(ev)) continue;
    const f = focusOf(ev.applyBy, ev.heldAt, ev.applyDone);
    if (f.date && f.date.slice(0, 10) <= limitKey && dueInstant(f.date) != null) {
      count++;
    }
  }
  return count;
}
