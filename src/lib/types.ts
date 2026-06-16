// ============================================================
// 就活Hub ドメイン型
// ============================================================

/** 選考ステップの種別 */
export type StepKind =
  | "entry" // エントリー
  | "es" // ES提出
  | "web_test" // Webテスト・適性検査
  | "video" // 録画動画
  | "gd" // グループディスカッション(GD)
  | "interview" // 面接
  | "final_interview" // 最終面接
  | "internship" // インターン参加
  | "other"; // その他

/** ステップの進捗状態 */
export type StepStatus = "not_started" | "in_progress" | "waiting" | "done"; // 未着手 / 進行中 / 結果待ち / 完了

/** 企業ごとの優先度 */
export type Priority = "high" | "medium" | "low"; // 高 / 中 / 低

/** 選考の最終的な結果ステータス */
export type ResultStatus =
  | "in_progress" // 進行中
  | "passed" // 通過・合格(表示は選考種別で内定/内々定/参加確定に変化)
  | "rejected" // 不合格
  | "declined"; // 辞退

/** 選考種別。合格後の表示が変わる */
export type SelectionType =
  | "long_intern" // 長期インターン → 参加確定
  | "short_intern" // 短期インターン → 参加確定
  | "early" // 早期選考 → 内々定
  | "main"; // 本選考 → 内定

/** インターンの開催形式 */
export type VenueMode = "" | "online" | "onsite"; // 未設定 / オンライン / 対面

/** 関連リンク(ラベル付きURL) */
export interface RelatedLink {
  id: string;
  label: string;
  url: string;
  /** 一覧カードにピン留め表示するか(最大2件) */
  pin?: boolean;
}

/** ES(エントリーシート)の設問と回答。企業ごとに保存して使い回せる */
export interface ESEntry {
  id: string;
  question: string;
  answer: string;
  /** 文字数制限。無ければ null(その場合は文字数のみ表示) */
  charLimit: number | null;
}

/** 選考ステップ(中核。1社が複数持つ) */
export interface SelectionStep {
  id: string;
  kind: StepKind;
  /** 自由記述の補足。例:「一次面接(オンライン)」 */
  name: string;
  /** 締切(申請/予約/提出期限)。"YYYY-MM-DD" もしくは "YYYY-MM-DDTHH:mm"。未設定は null */
  dueAt: string | null;
  /** 締切を消化したか(提出・予約済み)。true なら注目は実施日へ移る */
  dueDone?: boolean;
  /** 実施日(GD実施日・面接日など。締切とは別軸)。未設定は null */
  heldAt: string | null;
  status: StepStatus;
  /** 場所(住所/会場名 or "オンライン" 等。自由記述) */
  location: string;
  /** そのステップ個別のメモ */
  memo: string;
}

/** 1社の応募 */
export interface Application {
  id: string;
  company: string;
  role: string;
  priority: Priority;
  result: ResultStatus;
  selectionType: SelectionType;
  /** インターン時の開催形式 */
  venueMode: VenueMode;
  /** インターン開催地(対面時の場所) */
  venuePlace: string;
  links: RelatedLink[];
  /** ES設問・回答(企業ごとに保存・使い回し用) */
  esEntries: ESEntry[];
  /** 全体メモ(長文OK・改行保持) */
  memo: string;
  steps: SelectionStep[];
  createdAt: string;
  updatedAt: string;
}

/** 配色テーマ */
export type Theme = "indigo" | "aiNezu" | "sumi" | "navy" | "greige";

/** イベント(説明会/セミナー/OB訪問など)の状態 */
export type EventStatus = "todo" | "attended"; // 未参加 / 参加済

/** 説明会・イベント(選考フローとは別の単発イベント管理) */
export interface EventItem {
  id: string;
  company: string;
  /** イベント名(サブタイトル) */
  title: string;
  venueMode: VenueMode;
  venuePlace: string;
  /** 申込締切。一覧のソート主役。"YYYY-MM-DD" もしくは "YYYY-MM-DDTHH:mm"。未設定は null */
  applyBy: string | null;
  /** 申込締切を消化したか(申込済み)。true なら注目は開催日へ移る */
  applyDone?: boolean;
  /** 開催日時 */
  heldAt: string | null;
  url: string;
  memo: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

/** localStorage 保存形式 兼 エクスポート/インポート形式 */
export interface BackupFile {
  version: number;
  savedAt: string;
  applications: Application[];
  /** 旧バックアップには無い(後方互換のため任意) */
  events?: EventItem[];
}

// ------- UI 用の補助型 -------

export type SortKey = "deadline" | "priority" | "name";

/** 並べ替えの昇順／降順 */
export type SortDir = "asc" | "desc";

/** イベント一覧の並べ替えキー */
export type EventSortKey = "apply" | "held" | "name";

/** イベント一覧の絞り込み */
export interface EventFilters {
  /** 表示する状態(空 = すべて) */
  statuses: EventStatus[];
  onlyThisWeek: boolean;
}

/** 一覧での「状況」分類(フィルタ用・自動算出) */
export type Situation =
  | "in_progress"
  | "waiting"
  | "passed"
  | "rejected"
  | "declined";

export interface Filters {
  /** 表示する状況(空 = すべて) */
  situations: Situation[];
  /** 表示する優先度(空 = すべて) */
  priorities: Priority[];
  onlyThisWeek: boolean;
}
