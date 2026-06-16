import type {
  Application,
  BackupFile,
  ESEntry,
  Priority,
  RelatedLink,
  ResultStatus,
  SelectionStep,
  SelectionType,
  StepKind,
  StepStatus,
  VenueMode,
  EventItem,
  EventStatus,
} from "./types";
import { newId } from "./utils";

const PRIORITIES: Priority[] = ["high", "medium", "low"];
const RESULTS: ResultStatus[] = ["in_progress", "passed", "rejected", "declined"];
const SELECTION_TYPES: SelectionType[] = [
  "long_intern",
  "short_intern",
  "early",
  "main",
];
const VENUE_MODES: VenueMode[] = ["", "online", "onsite"];
const STEP_KINDS: StepKind[] = [
  "entry",
  "es",
  "web_test",
  "video",
  "gd",
  "interview",
  "final_interview",
  "internship",
  "other",
];
const STEP_STATUSES: StepStatus[] = [
  "not_started",
  "in_progress",
  "waiting",
  "done",
];

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as T)
    : fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function sanitizeStep(raw: any): SelectionStep {
  return {
    id: str(raw?.id) || newId(),
    kind: pick<StepKind>(raw?.kind, STEP_KINDS, "other"),
    name: str(raw?.name),
    dueAt:
      typeof raw?.dueAt === "string" && raw.dueAt.length > 0 ? raw.dueAt : null,
    dueDone: raw?.dueDone === true,
    heldAt:
      typeof raw?.heldAt === "string" && raw.heldAt.length > 0
        ? raw.heldAt
        : null,
    status: pick<StepStatus>(raw?.status, STEP_STATUSES, "not_started"),
    location: str(raw?.location),
    memo: str(raw?.memo),
  };
}

function sanitizeLink(raw: any): RelatedLink {
  return {
    id: str(raw?.id) || newId(),
    label: str(raw?.label),
    url: str(raw?.url),
    pin: raw?.pin === true,
  };
}

function sanitizeEsEntry(raw: any): ESEntry {
  return {
    id: str(raw?.id) || newId(),
    question: str(raw?.question),
    answer: str(raw?.answer),
    charLimit:
      typeof raw?.charLimit === "number" && raw.charLimit > 0
        ? Math.floor(raw.charLimit)
        : null,
  };
}

function sanitizeApp(raw: any): Application {
  const ts = new Date().toISOString();
  return {
    id: str(raw?.id) || newId(),
    company: str(raw?.company),
    role: str(raw?.role),
    priority: pick<Priority>(raw?.priority, PRIORITIES, "medium"),
    result: pick<ResultStatus>(raw?.result, RESULTS, "in_progress"),
    selectionType: pick<SelectionType>(
      raw?.selectionType,
      SELECTION_TYPES,
      "main",
    ),
    venueMode: pick<VenueMode>(raw?.venueMode, VENUE_MODES, ""),
    venuePlace: str(raw?.venuePlace),
    links: Array.isArray(raw?.links) ? raw.links.map(sanitizeLink) : [],
    esEntries: Array.isArray(raw?.esEntries)
      ? raw.esEntries.map(sanitizeEsEntry)
      : [],
    memo: str(raw?.memo),
    steps: Array.isArray(raw?.steps) ? raw.steps.map(sanitizeStep) : [],
    createdAt: str(raw?.createdAt) || ts,
    updatedAt: str(raw?.updatedAt) || ts,
  };
}

/** 任意の配列(旧形式含む)を最新の Application[] に正規化(欠損フィールドを補完) */
export function normalizeApps(arr: unknown): Application[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(sanitizeApp);
}

const EVENT_STATUSES: EventStatus[] = ["todo", "attended"];

function sanitizeEvent(raw: any): EventItem {
  const ts = new Date().toISOString();
  return {
    id: str(raw?.id) || newId(),
    company: str(raw?.company),
    title: str(raw?.title),
    venueMode: pick<VenueMode>(raw?.venueMode, VENUE_MODES, ""),
    venuePlace: str(raw?.venuePlace),
    applyBy:
      typeof raw?.applyBy === "string" && raw.applyBy.length > 0
        ? raw.applyBy
        : null,
    applyDone: raw?.applyDone === true,
    heldAt:
      typeof raw?.heldAt === "string" && raw.heldAt.length > 0
        ? raw.heldAt
        : null,
    url: str(raw?.url),
    memo: str(raw?.memo),
    status: pick<EventStatus>(raw?.status, EVENT_STATUSES, "todo"),
    createdAt: str(raw?.createdAt) || ts,
    updatedAt: str(raw?.updatedAt) || ts,
  };
}

/** 任意の配列(旧形式含む)を EventItem[] に正規化(欠損フィールドを補完) */
export function normalizeEvents(arr: unknown): EventItem[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(sanitizeEvent);
}

/** インポート JSON を Application[] に正規化(不正なら例外) */
export function parseBackup(text: string): Application[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("JSON として読み取れませんでした");
  }
  const apps = Array.isArray(data) ? data : (data as any)?.applications;
  if (!Array.isArray(apps)) {
    throw new Error("applications 配列が見つかりませんでした");
  }
  return apps.map(sanitizeApp);
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.readAsText(file);
  });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 現在のデータを JSON ファイルとしてダウンロード */
export function exportApplications(applications: Application[]) {
  const backup: BackupFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    applications,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `shukatsu-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
