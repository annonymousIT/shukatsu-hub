"use client";

import { useState } from "react";
import {
  Award,
  Check,
  ChevronRight,
  Clock,
  Copy,
  KeyRound,
  ListPlus,
  MinusCircle,
  Pin,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Application, SelectionStage } from "@/lib/types";
import { cn, safeHref } from "@/lib/utils";
import {
  PASSED_LABEL,
  SELECTION_TYPE_LABEL,
  SITUATION_LABEL,
  STEP_KIND_LABEL,
  STEP_KIND_SHORT,
} from "@/lib/constants";
import {
  currentStageLabel,
  getStageNextAction,
  situationOf,
  stageSegments,
  type StageNextAction,
  type StageSegState,
} from "@/lib/next-action";
import { dueToDate, splitDue, urgencyOf } from "@/lib/date";

const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 段階の見出し(段階名 > 先頭タスクの種別) */
function stageShort(stage: SelectionStage): string {
  if (stage.label.trim()) return stage.label.trim();
  const first = stage.tasks[0];
  return first ? STEP_KIND_SHORT[first.kind] : "段階";
}

function situationBadgeClass(sit: string): string {
  switch (sit) {
    case "in_progress":
      return "bg-accent text-accent-foreground";
    case "passed":
      return "bg-[hsl(var(--success)/0.14)] text-success";
    case "rejected":
      return "bg-[hsl(var(--danger)/0.1)] text-danger";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// 進捗バーの色は視認性優先で固定(テーマ非連動): 緑=通過 / 黄=やった待ち / 灰=未 / 赤=不合格
function segClass(state: StageSegState): string {
  switch (state) {
    case "passed":
      return "bg-success";
    case "waiting":
      return "bg-amber-400";
    case "failed":
      return "bg-danger";
    case "current":
      return "bg-foreground/30"; // 現在地(着手中)= 濃いめの灰
    case "declined":
      return "bg-[hsl(var(--muted-foreground)/0.4)]";
    default:
      return "bg-border"; // empty(未到達)
  }
}

export function ApplicationCard({
  app,
  onOpen,
  showRole = false,
  compact = false,
}: {
  app: Application;
  onOpen: () => void;
  showRole?: boolean;
  compact?: boolean;
}) {
  const next = getStageNextAction(app);
  const sit = situationOf(app);
  const segs = stageSegments(app);

  const u =
    next.type === "step" && next.focusDate
      ? urgencyOf(next.focusDate)
      : "none";
  const urgent = u === "overdue" || u === "soon" || u === "near";

  const sitLabel =
    sit === "passed" ? PASSED_LABEL[app.selectionType] : SITUATION_LABEL[sit];

  // ---- コンパクト表示(既定): 締切ブロック / 企業 / 次にやること + ピンリンク ----
  // 内定・参加確定=緑枠 / 不合格・辞退=全体うすめ / 緊急=赤枠
  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          "group block w-full cursor-pointer rounded-xl bg-card p-3 text-left shadow-[0_1px_2px_rgba(20,28,55,0.05),0_6px_16px_rgba(20,28,55,0.05)] transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0",
          sit === "passed"
            ? "ring-2 ring-[hsl(var(--success)/0.55)]"
            : urgent
              ? "ring-1 ring-[hsl(var(--danger)/0.55)]"
              : "ring-1 ring-border",
          sit === "rejected" || sit === "declined" ? "opacity-60" : "",
        )}
      >
        <div className="flex items-center gap-3">
          <DateBlock app={app} next={next} urgent={urgent} />
          <div className="min-w-0 flex-1 self-center">
            <div className="truncate text-[15px] font-semibold leading-tight">
              {app.company || "(名称未設定)"}
            </div>
            {showRole && app.role && (
              <div className="truncate text-[11px] text-muted-foreground">
                {app.role}
              </div>
            )}
            <NextLine app={app} next={next} />
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50" />
        </div>
        <PinnedChips app={app} className="mt-2" />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group block w-full cursor-pointer rounded-xl bg-card p-3 text-left shadow-[0_1px_2px_rgba(20,28,55,0.05),0_6px_16px_rgba(20,28,55,0.05)] ring-1 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(20,28,55,0.06),0_10px_22px_rgba(20,28,55,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0",
        urgent ? "ring-[hsl(var(--danger)/0.55)]" : "ring-border",
        sit === "rejected" || sit === "declined" ? "opacity-70" : "",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-medium",
            situationBadgeClass(sit),
          )}
        >
          {sitLabel}
        </span>
        {urgent && (
          <span className="text-[11px] font-medium text-danger">
            {next.focusKind === "held" ? "実施間近" : "締切間近"}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {SELECTION_TYPE_LABEL[app.selectionType]}
        </span>
      </div>

      <div className="mt-2 flex items-stretch gap-3">
        <DateBlock app={app} next={next} urgent={urgent} />
        <div className="min-w-0 flex-1 self-center">
          <div className="truncate text-[15px] font-semibold leading-tight">
            {app.company || "(名称未設定)"}
          </div>
          {showRole && app.role && (
            <div className="truncate text-[11px] text-muted-foreground">
              {app.role}
            </div>
          )}
          <NextLine app={app} next={next} />
        </div>
      </div>

      {segs.length > 0 && (
        <div className="mt-2.5">
          {segs.length <= 6 && (
            <div className="mb-1 flex gap-1.5">
              {segs.map((s) => (
                <div
                  key={s.stage.id}
                  className={cn(
                    "flex-1 truncate text-center text-[10px]",
                    s.state === "current"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground/70",
                  )}
                >
                  {stageShort(s.stage)}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            {segs.map((s) => (
              <div
                key={s.stage.id}
                className={cn("h-1 flex-1 rounded-full", segClass(s.state))}
              />
            ))}
          </div>
        </div>
      )}

      <PinnedChips app={app} className="mt-2.5" />
    </div>
  );
}

function DateBlock({
  app,
  next,
  urgent,
}: {
  app: Application;
  next: StageNextAction;
  urgent: boolean;
}) {
  if (next.type === "result") {
    const map = {
      passed: { icon: Award, cls: "text-success" },
      rejected: { icon: XCircle, cls: "text-danger" },
      declined: { icon: MinusCircle, cls: "text-muted-foreground" },
      in_progress: { icon: Clock, cls: "" },
    } as const;
    const r = map[app.result];
    const Icon = r.icon;
    return (
      <div className="flex w-14 shrink-0 items-center justify-center rounded-lg border bg-muted">
        <Icon className={cn("h-5 w-5", r.cls)} />
      </div>
    );
  }

  if (next.type === "waiting") {
    return (
      <div className="flex w-14 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        <Clock className="h-5 w-5" />
      </div>
    );
  }

  if (next.type === "empty") {
    return (
      <div className="flex w-14 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        <ListPlus className="h-4 w-4" />
      </div>
    );
  }

  const focus = next.focusDate;
  const kindLabel = next.focusKind === "held" ? "実施" : "締切";
  const d = focus ? dueToDate(focus) : null;
  const time = focus ? splitDue(focus).time : "";
  // 3行(締切/日付/時刻 or 曜日)。時刻があれば時刻、無ければ曜日。残り日数は詳細で。
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center",
        urgent ? "border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)]" : "bg-muted",
      )}
    >
      {d ? (
        <>
          <div
            className={cn(
              "text-[9px] font-medium leading-none",
              urgent ? "text-danger" : "text-muted-foreground",
            )}
          >
            {kindLabel}
          </div>
          <div
            className={cn(
              "mt-1 text-[16px] font-semibold leading-none",
              urgent ? "text-danger" : "text-foreground",
            )}
          >
            {d.getMonth() + 1}/{d.getDate()}
          </div>
          <div
            className={cn(
              "mt-1 text-[10px] font-medium leading-none",
              urgent ? "text-danger" : "text-muted-foreground",
            )}
          >
            {time || WD_EN[d.getDay()]}
          </div>
        </>
      ) : (
        <div className="text-[11px] text-muted-foreground">未定</div>
      )}
    </div>
  );
}

function NextLine({ app, next }: { app: Application; next: StageNextAction }) {
  if (next.type === "step") {
    // 種別(選考ステップ名)を表示。サブタイトル(name)ではなく kind を主役に
    const names = next.tasks.map((t) => STEP_KIND_LABEL[t.kind]).slice(0, 3);
    return (
      <div className="mt-1 truncate text-[12.5px]">
        <span className="text-muted-foreground">次: </span>
        <span className="font-medium">{names.join("・")}</span>
      </div>
    );
  }
  if (next.type === "waiting") {
    const label = currentStageLabel(app);
    return (
      <div className="mt-1 truncate text-[12.5px] text-muted-foreground">
        {label ? `${label} の結果待ち` : "結果待ち"}
      </div>
    );
  }
  if (next.type === "empty") {
    return (
      <div className="mt-1 truncate text-[12.5px] text-muted-foreground">
        選考ステップ未登録
      </div>
    );
  }
  return (
    <div className="mt-1 truncate text-[12.5px] text-muted-foreground">
      {app.result === "passed"
        ? `${PASSED_LABEL[app.selectionType]}（選考通過）`
        : app.result === "rejected"
          ? "不合格"
          : "辞退"}
    </div>
  );
}

/** カードにピン留めされたチップ列。ID(あれば最左) → ピン留めリンク(最大2)。 */
function PinnedChips({
  app,
  className,
}: {
  app: Application;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const pinned = app.links.filter((l) => l.pin && l.url).slice(0, 2);
  const id = app.loginId?.trim() ?? "";
  const hasId = !!app.loginIdPinned && id.length > 0;
  if (pinned.length === 0 && !hasId) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {hasId && (
        <button
          type="button"
          title="タップでIDをコピー"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard
              ?.writeText(id)
              .then(() => {
                toast.success("IDをコピーしました");
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1300);
              })
              .catch(() => {});
          }}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
            copied
              ? "border-[hsl(var(--success)/0.6)] bg-[hsl(var(--success)/0.12)] text-success"
              : "border-dashed border-[hsl(var(--primary)/0.45)] bg-accent text-accent-foreground hover:opacity-80",
          )}
        >
          {copied ? (
            <>
              <Check className="animate-evo-flip h-3 w-3" />
              コピーしました
            </>
          ) : (
            <>
              <KeyRound className="h-3 w-3" />
              <span className="max-w-[8rem] truncate">
                ID {app.loginIdMasked ? "••••••" : id}
              </span>
              <Copy className="h-3 w-3 opacity-70" />
            </>
          )}
        </button>
      )}
      {pinned.map((l) => (
        <a
          key={l.id}
          href={safeHref(l.url)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground transition-opacity hover:opacity-80"
        >
          <Pin className="h-3 w-3" />
          <span className="max-w-[8rem] truncate">{l.label || "リンク"}</span>
        </a>
      ))}
    </div>
  );
}
