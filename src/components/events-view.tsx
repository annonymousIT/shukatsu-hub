"use client";

import { useMemo, useState } from "react";
import { Bell, CalendarPlus, Plus, SearchX } from "lucide-react";
import type {
  EventFilters,
  EventItem,
  EventSortKey,
  SortDir,
  ViewMode,
} from "@/lib/types";
import { useStore } from "@/lib/store";
import { focusOf, isEventDone } from "@/lib/next-action";
import {
  dueInstant,
  dueToDate,
  isDueThisWeekOrOverdue,
  urgencyOf,
} from "@/lib/date";
import { EventCard } from "@/components/event-card";
import { EventsControlsBar } from "@/components/events-controls-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TERMINAL = Number.POSITIVE_INFINITY;
const NO_DATE = Number.MAX_SAFE_INTEGER;

const DEFAULT_FILTERS: EventFilters = { statuses: [], onlyThisWeek: false };

/** イベントの注目日(申込締切優先・消化/超過で開催へ)の絶対時刻。完了(参加済/辞退/開催済)は末尾。 */
function focusInst(ev: EventItem): number {
  if (isEventDone(ev)) return TERMINAL;
  const d = focusOf(ev.applyBy, ev.heldAt, ev.applyDone).date;
  return d ? (dueInstant(d) ?? NO_DATE) : NO_DATE;
}

export function EventsView({
  onOpenEvent,
  onAddEvent,
  viewMode,
  onViewModeChange,
}: {
  onOpenEvent: (id: string) => void;
  onAddEvent: () => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
}) {
  const { events } = useStore();
  const [sort, setSort] = useState<EventSortKey>("apply");
  const [dir, setDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);

  // 直近1週間(今日〜+7日、超過分も含む)の未完了イベントを日付順に
  const weekItems = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const lim = new Date();
    lim.setDate(lim.getDate() + 7);
    const limitKey = ymd(lim);

    return events
      .flatMap((ev) => {
        if (isEventDone(ev)) return [];
        const f = focusOf(ev.applyBy, ev.heldAt, ev.applyDone);
        if (!f.date) return [];
        if (f.date.slice(0, 10) > limitKey) return [];
        const inst = dueInstant(f.date);
        if (inst == null) return [];
        return [
          {
            ev,
            date: f.date,
            inst,
            kind: f.kind === "held" ? "開催" : "締切",
            urgent: ["overdue", "soon", "near"].includes(urgencyOf(f.date)),
          },
        ];
      })
      .sort((a, b) => a.inst - b.inst);
  }, [events]);

  const visible = useMemo(() => {
    const list = events.filter((ev) => {
      if (filters.statuses.length && !filters.statuses.includes(ev.status))
        return false;
      if (
        filters.onlyThisWeek &&
        !(
          !isEventDone(ev) &&
          isDueThisWeekOrOverdue(
            focusOf(ev.applyBy, ev.heldAt, ev.applyDone).date,
          )
        )
      )
        return false;
      return true;
    });
    const dirMul = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let r: number;
      if (sort === "name") {
        r = a.company.localeCompare(b.company, "ja");
      } else if (sort === "held") {
        const ai = a.heldAt ? (dueInstant(a.heldAt) ?? NO_DATE) : NO_DATE;
        const bi = b.heldAt ? (dueInstant(b.heldAt) ?? NO_DATE) : NO_DATE;
        r = ai - bi || a.company.localeCompare(b.company, "ja");
      } else {
        r = focusInst(a) - focusInst(b) || a.company.localeCompare(b.company, "ja");
      }
      return r * dirMul;
    });
  }, [events, sort, dir, filters]);

  if (events.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
          <CalendarPlus className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-semibold">説明会・イベントを登録</h2>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          申込締切と開催日を入れておけば、選考と同じく締切が近い順に並びます。
        </p>
        <Button className="mt-5" onClick={onAddEvent}>
          <Plus className="h-4 w-4" />
          最初のイベントを追加
        </Button>
      </div>
    );
  }

  const hasUrgent = weekItems.some((x) => x.urgent);
  const shown = weekItems.slice(0, 6);
  const rest = weekItems.length - shown.length;
  const accent =
    weekItems.length === 0
      ? "text-muted-foreground"
      : hasUrgent
        ? "text-danger"
        : "text-primary";

  return (
    <>
      {/* 直近1週間の予定(固定枠) */}
      <div
        className={cn(
          "rounded-xl bg-card p-3 shadow-[0_1px_2px_rgba(20,28,55,0.05),0_6px_16px_rgba(20,28,55,0.05)] ring-2",
          weekItems.length === 0
            ? "ring-border"
            : hasUrgent
              ? "ring-[hsl(var(--danger)/0.6)]"
              : "ring-[hsl(var(--primary)/0.75)]",
        )}
      >
        <div className="flex items-center gap-1.5 text-[12px] font-medium">
          <Bell className={cn("h-3.5 w-3.5", accent)} />
          <span className={accent}>直近1週間の予定</span>
          {weekItems.length > 0 && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              {weekItems.length}件
            </span>
          )}
        </div>
        {weekItems.length > 0 ? (
          <div className="mt-1.5 space-y-1">
            {shown.map((x) => {
              const d = dueToDate(x.date);
              return (
                <div
                  key={x.ev.id}
                  className="flex items-center gap-2.5 text-[12.5px]"
                >
                  <span
                    className={cn(
                      "w-9 shrink-0 font-medium",
                      x.urgent ? "text-danger" : "text-primary",
                    )}
                  >
                    {d ? `${d.getMonth() + 1}/${d.getDate()}` : "未定"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">
                      {x.ev.company || x.ev.title || "(未設定)"}
                    </span>
                    <span className="text-muted-foreground">
                      ・{x.ev.title || "イベント"}
                    </span>
                  </span>
                </div>
              );
            })}
            {rest > 0 && (
              <div className="pl-[2.875rem] text-[11px] text-muted-foreground">
                ほか{rest}件
              </div>
            )}
          </div>
        ) : (
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            直近1週間の予定はありません
          </p>
        )}
      </div>

      <div className="mt-3">
        <EventsControlsBar
          sort={sort}
          onSortChange={setSort}
          dir={dir}
          onDirChange={setDir}
          filters={filters}
          onFiltersChange={setFilters}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
          <SearchX className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            条件に一致するイベントがありません
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            フィルターをリセット
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {visible.map((ev) => (
            <div key={ev.id}>
              <EventCard
                ev={ev}
                onOpen={() => onOpenEvent(ev.id)}
                compact={viewMode === "compact"}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
