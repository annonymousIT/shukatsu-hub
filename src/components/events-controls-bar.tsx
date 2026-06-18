"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Check,
  LayoutList,
  Rows3,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  EventFilters,
  EventSortKey,
  EventStatus,
  SortDir,
  ViewMode,
} from "@/lib/types";

const SORT_LABEL: Record<EventSortKey, string> = {
  apply: "申込締切順",
  held: "開催日順",
  name: "企業名順",
};

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: "todo", label: "未参加" },
  { value: "attended", label: "参加済" },
  { value: "declined", label: "辞退" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground ring-1 ring-inset ring-[hsl(var(--primary))]"
          : "bg-secondary text-foreground ring-1 ring-inset ring-[hsl(var(--muted-foreground)/0.32)] hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function EventsControlsBar({
  sort,
  onSortChange,
  dir,
  onDirChange,
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
}: {
  sort: EventSortKey;
  onSortChange: (s: EventSortKey) => void;
  dir: SortDir;
  onDirChange: (d: SortDir) => void;
  filters: EventFilters;
  onFiltersChange: (f: EventFilters) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = filters.statuses.length + (filters.onlyThisWeek ? 1 : 0);

  const toggleStatus = (s: EventStatus) =>
    onFiltersChange({
      ...filters,
      statuses: filters.statuses.includes(s)
        ? filters.statuses.filter((x) => x !== s)
        : [...filters.statuses, s],
    });

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Select
          value={sort}
          onValueChange={(v) => onSortChange(v as EventSortKey)}
        >
          <SelectTrigger className="h-9 min-w-0 flex-1 bg-card text-sm">
            <ArrowDownUp className="mr-1 h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABEL) as EventSortKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 bg-card"
          aria-label={dir === "asc" ? "昇順（タップで降順に）" : "降順（タップで昇順に）"}
          title={
            dir === "asc"
              ? "昇順 — 締切順なら近い順"
              : "降順 — 締切順なら遠い順"
          }
          onClick={() => onDirChange(dir === "asc" ? "desc" : "asc")}
        >
          {dir === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-9 shrink-0 bg-card"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" />
        絞り込み
        {activeCount > 0 && (
          <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-medium text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 bg-card"
            aria-label="表示モード"
            title="表示モード（コンパクト / 詳細）"
          >
            {viewMode === "compact" ? (
              <LayoutList className="h-4 w-4" />
            ) : (
              <Rows3 className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onViewModeChange("compact")}>
            <LayoutList className="h-4 w-4" />
            <span className="flex-1">コンパクト</span>
            {viewMode === "compact" && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewModeChange("detail")}>
            <Rows3 className="h-4 w-4" />
            <span className="flex-1">詳細</span>
            {viewMode === "detail" && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-7 pt-4">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
          <SheetTitle className="mb-4 text-base">絞り込み</SheetTitle>

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs text-muted-foreground">
                状態（複数選択OK）
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    active={filters.statuses.includes(o.value)}
                    onClick={() => toggleStatus(o.value)}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  onlyThisWeek: !filters.onlyThisWeek,
                })
              }
              className="flex w-full items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm"
            >
              <span>今週のイベントだけ表示</span>
              <span
                className={cn(
                  "relative h-6 w-10 rounded-full transition-colors",
                  filters.onlyThisWeek ? "bg-primary" : "bg-border",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all",
                    filters.onlyThisWeek ? "left-[18px]" : "left-0.5",
                  )}
                />
              </span>
            </button>
          </div>

          <div className="mt-5 flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() =>
                onFiltersChange({ statuses: [], onlyThisWeek: false })
              }
            >
              <RotateCcw className="h-4 w-4" />
              リセット
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              閉じる
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
