"use client";

import { ChevronRight, Clock, Pin } from "lucide-react";
import type { EventItem } from "@/lib/types";
import { cn, safeHref } from "@/lib/utils";
import { dueInstant, dueToDate, splitDue, urgencyOf } from "@/lib/date";
import { focusOf, isEventDone } from "@/lib/next-action";

const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function EventCard({
  ev,
  onOpen,
  compact = false,
}: {
  ev: EventItem;
  onOpen: () => void;
  compact?: boolean;
}) {
  const attended = ev.status === "attended";
  const declined = ev.status === "declined";
  const done = isEventDone(ev); // 参加済/辞退/開催済は注目度を下げる
  // 状態未設定だが開催日が過ぎた=「終了」
  const ended =
    ev.status === "todo" &&
    !!ev.heldAt &&
    (dueInstant(ev.heldAt) ?? Infinity) < Date.now();
  // 注目日: 申込締切を優先、消化/超過で開催日へ(選考ステップと同じ focusOf ロジック)
  const f = focusOf(ev.applyBy, ev.heldAt, ev.applyDone);
  const focus = f.date;
  const focusKind = f.kind === "held" ? "開催" : "締切";
  const u = !done && focus ? urgencyOf(focus) : "none";
  const urgent = u === "overdue" || u === "soon" || u === "near";
  const d = focus ? dueToDate(focus) : null;
  const venue =
    ev.venueMode === "online"
      ? "オンライン"
      : ev.venueMode === "onsite"
        ? ev.venuePlace || "対面"
        : ev.venuePlace;
  const pinned = ev.links.filter((l) => l.pin && l.url).slice(0, 2);
  const statusLabel = attended ? "参加済" : declined ? "辞退" : ended ? "終了" : null;

  // ---- コンパクト表示(既定): 日付 / イベント名 / 企業・会場 + 状態 + ピンリンク ----
  // 参加済=緑枠 / 辞退・終了=全体うすめ / 締切間近=赤枠
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
          attended
            ? "ring-2 ring-[hsl(var(--success)/0.55)]"
            : urgent
              ? "ring-1 ring-[hsl(var(--danger)/0.55)]"
              : "ring-1 ring-border",
          declined || ended ? "opacity-60" : "",
        )}
      >
        <div className="flex items-center gap-3">
          <EventDateBlock d={d} kind={focusKind} focus={focus} urgent={urgent} />
          <div className="min-w-0 flex-1 self-center">
            <div className="truncate text-[15px] font-semibold leading-tight">
              {ev.title || "(イベント名未設定)"}
            </div>
            <div className="truncate text-[11.5px] text-muted-foreground">
              {ev.company || "(企業未設定)"}
              {venue ? ` · ${venue}` : ""}
            </div>
            {statusLabel && (
              <div
                className={cn(
                  "text-[12px]",
                  attended
                    ? "font-medium text-success"
                    : "text-muted-foreground",
                )}
              >
                {statusLabel}
              </div>
            )}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50" />
        </div>
        {pinned.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
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
                <span className="max-w-[8rem] truncate">
                  {l.label || "リンク"}
                </span>
              </a>
            ))}
          </div>
        )}
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
        done ? "opacity-70" : "",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-medium",
            attended
              ? "bg-[hsl(var(--success)/0.14)] text-success"
              : declined || ended
                ? "bg-muted text-muted-foreground"
                : "bg-accent text-accent-foreground",
          )}
        >
          {attended ? "参加済" : declined ? "辞退" : ended ? "終了" : "未参加"}
        </span>
        {urgent && !done && (
          <span className="text-[11px] font-medium text-danger">
            {focusKind}間近
          </span>
        )}
      </div>

      <div className="mt-2 flex items-stretch gap-3">
        <EventDateBlock d={d} kind={focusKind} focus={focus} urgent={urgent} />
        <div className="min-w-0 flex-1 self-center">
          <div className="truncate text-[14px] font-semibold leading-tight">
            {ev.title || "(イベント名未設定)"}
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {ev.company || "(企業未設定)"}
            {venue ? ` · ${venue}` : ""}
          </div>
        </div>
      </div>

      {pinned.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
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
      )}
    </div>
  );
}

function EventDateBlock({
  d,
  kind,
  focus,
  urgent,
}: {
  d: Date | null;
  kind: string;
  focus: string | null;
  urgent: boolean;
}) {
  const time = focus ? splitDue(focus).time : "";
  if (!d) {
    return (
      <div className="flex w-14 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        <Clock className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center",
        urgent
          ? "border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)]"
          : "bg-muted",
      )}
    >
      <div
        className={cn(
          "text-[9px] font-medium leading-none",
          urgent ? "text-danger" : "text-muted-foreground",
        )}
      >
        {kind}
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
    </div>
  );
}
