import {
  Send,
  FileText,
  ClipboardList,
  Video,
  Users,
  MessagesSquare,
  Crown,
  Briefcase,
  Circle,
  type LucideIcon,
} from "lucide-react";
import type {
  Priority,
  ResultStatus,
  SelectionType,
  Situation,
  StepKind,
  StepStatus,
  Theme,
} from "./types";

// ---------------- 選択肢 ----------------

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

export const RESULT_OPTIONS: { value: ResultStatus; label: string }[] = [
  { value: "in_progress", label: "進行中" },
  { value: "passed", label: "通過・合格" },
  { value: "rejected", label: "不合格" },
  { value: "declined", label: "辞退" },
];

export const SELECTION_TYPE_OPTIONS: { value: SelectionType; label: string }[] =
  [
    { value: "main", label: "本選考" },
    { value: "early", label: "早期選考" },
    { value: "long_intern", label: "長期インターン" },
    { value: "short_intern", label: "短期インターン" },
  ];

export const STEP_KIND_OPTIONS: { value: StepKind; label: string }[] = [
  { value: "entry", label: "エントリー" },
  { value: "es", label: "ES提出" },
  { value: "web_test", label: "Webテスト・適性検査" },
  { value: "video", label: "録画動画" },
  { value: "gd", label: "グループディスカッション(GD)" },
  { value: "interview", label: "面接" },
  { value: "final_interview", label: "最終面接" },
  { value: "internship", label: "インターン参加" },
  { value: "other", label: "その他" },
];

export const STEP_STATUS_OPTIONS: { value: StepStatus; label: string }[] = [
  { value: "not_started", label: "未着手" },
  { value: "in_progress", label: "進行中" },
  { value: "waiting", label: "結果待ち" },
  { value: "done", label: "完了" },
];

// ---------------- ラベル ----------------

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export const RESULT_LABEL: Record<ResultStatus, string> = {
  in_progress: "進行中",
  passed: "合格",
  rejected: "不合格",
  declined: "辞退",
};

export const SELECTION_TYPE_LABEL: Record<SelectionType, string> = {
  long_intern: "長期インターン",
  short_intern: "短期インターン",
  early: "早期選考",
  main: "本選考",
};

/** 合格(passed)時の表示は選考種別で変わる */
export const PASSED_LABEL: Record<SelectionType, string> = {
  long_intern: "参加確定",
  short_intern: "参加確定",
  early: "内々定",
  main: "内定",
};

export function isInternType(t: SelectionType): boolean {
  return t === "long_intern" || t === "short_intern";
}

export const STEP_KIND_LABEL: Record<StepKind, string> = STEP_KIND_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<StepKind, string>,
);

/** 進捗トラックのラベル用の短縮名 */
export const STEP_KIND_SHORT: Record<StepKind, string> = {
  entry: "エントリー",
  es: "ES",
  web_test: "Web",
  video: "録画",
  gd: "GD",
  interview: "面接",
  final_interview: "最終",
  internship: "参加",
  other: "その他",
};

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  not_started: "未着手",
  in_progress: "進行中",
  waiting: "結果待ち",
  done: "完了",
};

export const SITUATION_LABEL: Record<Situation, string> = {
  in_progress: "進行中",
  waiting: "結果待ち",
  passed: "合格",
  rejected: "不合格",
  declined: "辞退",
};

export const SITUATION_OPTIONS: Situation[] = [
  "in_progress",
  "waiting",
  "passed",
  "rejected",
  "declined",
];

// ---------------- アイコン ----------------

export const STEP_KIND_ICON: Record<StepKind, LucideIcon> = {
  entry: Send,
  es: FileText,
  web_test: ClipboardList,
  video: Video,
  gd: Users,
  interview: MessagesSquare,
  final_interview: Crown,
  internship: Briefcase,
  other: Circle,
};

// ---------------- テーマ ----------------

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "indigo", label: "標準" },
  { value: "aiNezu", label: "藍鼠" },
  { value: "sumi", label: "墨" },
  { value: "navy", label: "ネイビー" },
  { value: "greige", label: "グレージュ" },
];

// ---------------- localStorage キー ----------------

export const LS_KEY = "shukatsu-dashboard:v1";
export const LS_THEME_KEY = "shukatsu-dashboard:theme";
export const LS_ONBOARDED_KEY = "shukatsu-dashboard:onboarded";
/** サンプル投入済みフラグ(初回チュートリアル用) */
export const LS_SEEDED_KEY = "shukatsu-dashboard:seeded";
/** 規約同意フラグ */
export const LS_LEGAL_KEY = "shukatsu-dashboard:legal-accepted";

/** チュートリアル用サンプル企業の固定ID(自動削除に使う) */
export const SAMPLE_APP_ID = "sample-anit-co";
