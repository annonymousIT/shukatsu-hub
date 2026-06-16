"use client";

import { Award, Clock, ListPlus, MinusCircle, Pin, XCircle } from "lucide-react";
import type { Application } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  PASSED_LABEL,
  SELECTION_TYPE_LABEL,
  SITUATION_LABEL,
  STEP_KIND_LABEL,
  STEP_KIND_SHORT,
} from "@/lib/constants";
import {
  getNextAction,
  situationOf,
  trackSegments,
  type SegState,
} from "@/lib/next-action";
import { dueToDate, relativeLabel, urgencyOf } from "@/lib/date";

const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function segClass(state: SegState): string {
  switch (state) {
    case "done":
      return "bg-primary";
    case "waiting":
      return "bg-[hsl(var(--muted-foreground)/0.5)]";
    case "failed":
      return "bg-danger";
    case "declined":
      return "bg-[hsl(var(--muted-foreground)/0.4)]";
    default:
      return "bg-border";
  }
}

function Seg({ state }: { state: SegState }) {
  if (state === "current") {
    return (
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/2 rounded-full bg-primary" />
      </div>
    );
  }
  return <div className={cn("h-1 flex-1 rounded-full", segClass(state))} />;
}

export function ApplicationCard({
  app,
  onOpen,
  showRole = false,
}: {
  app: Application;
  onOpen: () => void;
  showRole?: boolean;
}) {
  const next = getNextAction(app);
  const sit = situationOf(app);
  const segs = trackSegments(app);
  const pinned = app.links.filter((l) => l.pin && l.url).slice(0, 2);

  const u =
    next.type === "step" && next.step?.dueAt
      ? urgencyOf(next.step.dueAt)
      : "none";
  const urgent = u === "overdue" || u === "soon" || u === "near";

  const sitLabel =
    sit === "passed" ? PASSED_LABEL[app.selectionType] : SITUATION_LABEL[sit];

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
          <span className="text-[11px] font-medium text-danger">締切間近</span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {SELECTION_TYPE_LABEL[app.selectionType]}
        </span>
      </div>

      <div className="mt-2 flex items-stretch gap-3">
        <DateBlock app={app} urgent={urgent} />
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
          {segs.length <= 5 && (
            <div className="mb-1 flex gap-1.5">
              {segs.map((s) => (
                <div
                  key={s.step.id}
                  className={cn(
                    "flex-1 truncate text-center text-[10px]",
                    s.state === "current" || s.state === "next"
                      ? "font-medium text-primary"
                      : "text-muted-foreground/70",
                  )}
                >
                  {STEP_KIND_SHORT[s.step.kind]}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            {segs.map((s) => (
              <Seg key={s.step.id} state={s.state} />
            ))}
          </div>
        </div>
      )}

      {pinned.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {pinned.map((l) => (
            <a
              key={l.id}
              href={l.url}
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
      )}
    </div>
  );
}

function DateBlock({ app, urgent }: { app: Application; urgent: boolean }) {
  const next = getNextAction(app);

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

  const step = next.step!;
  const d = step.dueAt ? dueToDate(step.dueAt) : null;
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
              "text-[15px] font-semibold leading-none",
              urgent ? "text-danger" : "text-foreground",
            )}
          >
            {d.getMonth() + 1}/{d.getDate()}
          </div>
          <div
            className={cn(
              "mt-0.5 text-[10px] font-medium leading-none",
              urgent ? "text-danger" : "text-muted-foreground",
            )}
          >
            {WD_EN[d.getDay()]}
          </div>
          <div
            className={cn(
              "mt-1 whitespace-nowrap text-[10px] leading-none",
              urgent ? "text-danger" : "text-muted-foreground",
            )}
          >
            {relativeLabel(step.dueAt)}
          </div>
        </>
      ) : (
        <div className="text-[11px] text-muted-foreground">未定</div>
      )}
    </div>
  );
}

function NextLine({
  app,
  next,
}: {
  app: Application;
  next: ReturnType<typeof getNextAction>;
}) {
  if (next.type === "step") {
    return (
      <div className="mt-1 truncate text-[12.5px]">
        <span className="text-muted-foreground">次: </span>
        <span className="font-medium">{STEP_KIND_LABEL[next.step!.kind]}</span>
      </div>
    );
  }
  if (next.type === "waiting") {
    const s = next.step;
    return (
      <div className="mt-1 truncate text-[12.5px] text-muted-foreground">
        {s ? `${STEP_KIND_LABEL[s.kind]}の結果待ち` : "結果待ち（全ステップ完了）"}
      </div>
    );
  }
  if (next.type === "empty") {
    return (
      <div className="mt-1 truncate text-[12.5px] text-muted-foreground">
        ステップ未登録
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
