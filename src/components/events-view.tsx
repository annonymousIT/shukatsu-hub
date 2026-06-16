"use client";

import { useMemo, useState } from "react";
import { Bell, CalendarPlus, Plus, SearchX } from "lucide-react";
import type {
  EventFilters,
  EventItem,
  EventSortKey,
  SortDir,
} from "@/lib/types";
import { useStore } from "@/lib/store";
import { focusOf } from "@/lib/next-action";
import {
  dueInstant,
  dueToDate,
  isDueThisWeekOrOverdue,
  relativeLabel,
  urgencyOf,
} from "@/lib/date";
import { EventCard } from "@/components/event-card";
import { EventsControlsBar } from "@/components/events-controls-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TERMINAL = Number.POSITIVE_INFINITY;
const NO_DATE = Number.MAX_SAFE_INTEGER;

const DEFAULT_FILTERS: EventFilters = { statuses: [], onlyThisWeek: false };

/** イベントの注目日(申込締切優先・消化/超過で開催へ)の絶対時刻。参加済は末尾。 */
function focusInst(ev: EventItem): number {
  if (ev.status === "attended") return TERMINAL;
  const d = focusOf(ev.applyBy, ev.heldAt, ev.applyDone).date;
  return d ? (dueInstant(d) ?? NO_DATE) : NO_DATE;
}

export function EventsView({
  onOpenEvent,
  onAddEvent,
}: {
  onOpenEvent: (id: string) => void;
  onAddEvent: () => void;
}) {
  const { events } = useStore();
  const [sort, setSort] = useState<EventSortKey>("apply");
  const [dir, setDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);

  const stats = useMemo(
    () => ({
      thisWeek: events.filter(
        (ev) =>
          ev.status !== "attended" &&
          isDueThisWeekOrOverdue(
            focusOf(ev.applyBy, ev.heldAt, ev.applyDone).date,
          ),
      ).length,
      todo: events.filter((ev) => ev.status === "todo").length,
      attended: events.filter((ev) => ev.status === "attended").length,
    }),
    [events],
  );

  // 直近の予定: 今日から最も近い未参加イベント(1週間以内に限らず、必ず最も近いものを出す)
  const upcoming = useMemo(() => {
    let best:
      | { ev: EventItem; date: string; inst: number }
      | null = null;
    for (const ev of events) {
      if (ev.status === "attended") continue;
      const f = focusOf(ev.applyBy, ev.heldAt, ev.applyDone);
      if (!f.date) continue;
      const inst = dueInstant(f.date);
      if (inst == null) continue;
      if (!best || inst < best.inst) best = { ev, date: f.date, inst };
    }
    return best;
  }, [events]);

  const visible = useMemo(() => {
    const list = events.filter((ev) => {
      if (filters.statuses.length && !filters.statuses.includes(ev.status))
        return false;
      if (
        filters.onlyThisWeek &&
        !(
          ev.status !== "attended" &&
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

  const urgent = upcoming
    ? ["overdue", "soon", "near"].includes(urgencyOf(upcoming.date))
    : false;
  const d0 = upcoming ? dueToDate(upcoming.date) : null;

  return (
    <>
      <p className="px-0.5 text-[13px] text-muted-foreground">
        今週 <b className="font-semibold text-danger">{stats.thisWeek}件</b> ·
        未参加 {stats.todo} · 参加済 {stats.attended}
      </p>

      {upcoming && d0 && (
        <div className="mt-3">
          <div
            className={cn(
              "rounded-xl bg-card p-3 shadow-[0_1px_2px_rgba(20,28,55,0.05),0_6px_16px_rgba(20,28,55,0.05)] ring-1",
              urgent ? "ring-[hsl(var(--danger)/0.45)]" : "ring-border",
            )}
            style={{
              borderLeft: "3px solid",
              borderLeftColor: urgent
                ? "hsl(var(--danger))"
                : "hsl(var(--primary))",
            }}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-medium">
              <Bell
                className={cn(
                  "h-3.5 w-3.5",
                  urgent ? "text-danger" : "text-primary",
                )}
              />
              <span className={urgent ? "text-danger" : "text-primary"}>
                直近の予定
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {d0.getMonth() + 1}/{d0.getDate()} ·{" "}
                {relativeLabel(upcoming.date)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[12.5px]">
              <span
                className={cn(
                  "h-1 w-1 shrink-0 rounded-full",
                  urgent ? "bg-danger" : "bg-primary",
                )}
              />
              <b className="font-medium">
                {upcoming.ev.company || "(企業未設定)"}
              </b>
              <span className="truncate text-muted-foreground">
                {upcoming.ev.title || "(イベント名未設定)"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3">
        <EventsControlsBar
          sort={sort}
          onSortChange={setSort}
          dir={dir}
          onDirChange={setDir}
          filters={filters}
          onFiltersChange={setFilters}
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
            <div key={ev.id} className="animate-fade-in">
              <EventCard ev={ev} onOpen={() => onOpenEvent(ev.id)} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
