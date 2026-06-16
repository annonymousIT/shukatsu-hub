"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  LayoutTemplate,
  ListPlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Application, StepKind, StepStatus } from "@/lib/types";
import { useStore } from "@/lib/store";
import {
  STEP_KIND_ICON,
  STEP_KIND_LABEL,
  STEP_KIND_OPTIONS,
  STEP_STATUS_LABEL,
  STEP_STATUS_OPTIONS,
} from "@/lib/constants";
import { getNextActionStep, stepFocusDate } from "@/lib/next-action";
import {
  joinDue,
  relativeLabel,
  splitDue,
  urgencyOf,
  type Urgency,
} from "@/lib/date";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_ORDER: StepStatus[] = [
  "not_started",
  "in_progress",
  "waiting",
  "done",
];

const TEMPLATES: { label: string; kinds: StepKind[] }[] = [
  {
    label: "本選考フル",
    kinds: ["entry", "es", "web_test", "gd", "interview", "final_interview"],
  },
  { label: "短期インターン", kinds: ["entry", "es", "interview", "internship"] },
  { label: "早期選考", kinds: ["entry", "es", "interview", "final_interview"] },
];

function dueTextClass(u: Urgency): string {
  if (u === "overdue" || u === "soon" || u === "near") return "text-danger";
  return "text-muted-foreground";
}

function StatusDot({
  status,
  onClick,
}: {
  status: StepStatus;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cls =
    status === "done"
      ? "bg-primary text-primary-foreground border-2 border-primary"
      : status === "in_progress"
        ? "border-2 border-primary"
        : status === "waiting"
          ? "border-2 border-muted-foreground/50 text-muted-foreground"
          : "border-2 border-input";
  return (
    <button
      type="button"
      data-tour="status-dot"
      onClick={onClick}
      title={`状態: ${STEP_STATUS_LABEL[status]}（タップで切替）`}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card transition-transform hover:scale-110",
        cls,
      )}
    >
      {status === "done" && <Check className="h-3.5 w-3.5" />}
      {status === "in_progress" && (
        <span className="h-2 w-2 rounded-full bg-primary" />
      )}
      {status === "waiting" && <Clock className="h-3 w-3" />}
    </button>
  );
}

export function StepTimeline({ app }: { app: Application }) {
  const {
    addStep,
    addStepsBulk,
    replaceSteps,
    updateStep,
    deleteStep,
    moveStep,
  } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const nextId = getNextActionStep(app)?.id;
  // 全ステップが完全に手付かず(空)なら、テンプレ適用は「置換」、着手後は「追加」
  const pristine =
    app.steps.length === 0 ||
    app.steps.every(
      (s) =>
        s.status === "not_started" &&
        !s.dueAt &&
        !s.name.trim() &&
        !s.location.trim() &&
        !s.memo.trim(),
    );

  const cycle = (id: string, status: StepStatus) =>
    updateStep(app.id, id, {
      status: STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % 4],
    });

  return (
    <div>
      {app.steps.length === 0 ? (
        <p className="rounded-lg border border-dashed py-5 text-center text-sm text-muted-foreground">
          まだステップがありません。
          <br />
          下の「テンプレから」で一気に追加できます。
        </p>
      ) : (
        <div className="flex flex-col">
          {app.steps.map((step, i) => {
            const Icon = STEP_KIND_ICON[step.kind];
            const isNext = step.id === nextId;
            const isEditing = editingId === step.id;
            const { date, time } = splitDue(step.dueAt);
            const { date: hDate, time: hTime } = splitDue(step.heldAt);
            const focusAt = stepFocusDate(step);
            const u: Urgency =
              step.status !== "done" && focusAt
                ? urgencyOf(focusAt)
                : "none";

            return (
              <div key={step.id} data-tour={i === 0 ? "step" : undefined}>
                {i > 0 && <div className="ml-[19px] h-2.5 w-px bg-border" />}
                <div
                  className={cn(
                    "rounded-lg border bg-card shadow-[0_1px_2px_rgba(20,28,55,0.04)]",
                    isNext && !isEditing && "ring-1 ring-[hsl(var(--primary)/0.4)]",
                    isEditing && "ring-2 ring-[hsl(var(--primary)/0.4)]",
                  )}
                >
                  {isEditing ? (
                    <div className="space-y-2 p-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Select
                          value={step.kind}
                          onValueChange={(v) =>
                            updateStep(app.id, step.id, { kind: v as StepKind })
                          }
                        >
                          <SelectTrigger className="h-8 flex-1 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STEP_KIND_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isNext && (
                          <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                            次にやる
                          </span>
                        )}
                      </div>
                      <Input
                        value={step.name}
                        onChange={(e) =>
                          updateStep(app.id, step.id, { name: e.target.value })
                        }
                        placeholder="補足名(任意) 例: 一次(オンライン)"
                        className="h-9"
                      />
                      <div className="space-y-3 rounded-lg border bg-muted/40 p-2.5">
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-medium text-muted-foreground">
                            締切（申請・予約・提出など）
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={date}
                              onChange={(e) =>
                                updateStep(app.id, step.id, {
                                  dueAt: joinDue(e.target.value, time),
                                })
                              }
                              className="h-10 min-w-0 flex-1 px-2.5 text-[16px] sm:text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-muted-foreground"
                              disabled={!date}
                              title="締切をクリア"
                              onClick={() =>
                                updateStep(app.id, step.id, { dueAt: null })
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={time}
                              disabled={!date}
                              onChange={(e) =>
                                updateStep(app.id, step.id, {
                                  dueAt: joinDue(date, e.target.value),
                                })
                              }
                              className="h-10 min-w-0 flex-1 px-2.5 text-[16px] sm:text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-muted-foreground"
                              disabled={!time}
                              title="時刻をクリア"
                              onClick={() =>
                                updateStep(app.id, step.id, {
                                  dueAt: joinDue(date, ""),
                                })
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1.5 border-t pt-2.5">
                          <div className="text-[11px] font-medium text-muted-foreground">
                            実施日（GD・面接など）
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={hDate}
                              onChange={(e) =>
                                updateStep(app.id, step.id, {
                                  heldAt: joinDue(e.target.value, hTime),
                                })
                              }
                              className="h-10 min-w-0 flex-1 px-2.5 text-[16px] sm:text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-muted-foreground"
                              disabled={!hDate}
                              title="実施日をクリア"
                              onClick={() =>
                                updateStep(app.id, step.id, { heldAt: null })
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={hTime}
                              disabled={!hDate}
                              onChange={(e) =>
                                updateStep(app.id, step.id, {
                                  heldAt: joinDue(hDate, e.target.value),
                                })
                              }
                              className="h-10 min-w-0 flex-1 px-2.5 text-[16px] sm:text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-muted-foreground"
                              disabled={!hTime}
                              title="時刻をクリア"
                              onClick={() =>
                                updateStep(app.id, step.id, {
                                  heldAt: joinDue(hDate, ""),
                                })
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">
                          状態
                        </label>
                        <Select
                          value={step.status}
                          onValueChange={(v) =>
                            updateStep(app.id, step.id, {
                              status: v as StepStatus,
                            })
                          }
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STEP_STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        value={step.location}
                        onChange={(e) =>
                          updateStep(app.id, step.id, {
                            location: e.target.value,
                          })
                        }
                        placeholder="場所(任意) 例: オンライン / 東京・大手町"
                        className="h-9"
                      />
                      <Textarea
                        value={step.memo}
                        onChange={(e) =>
                          updateStep(app.id, step.id, { memo: e.target.value })
                        }
                        placeholder="メモ(任意) 例: 玉手箱形式 / GDは6人30分"
                        className="min-h-[44px] resize-y text-sm"
                      />
                      <div className="flex items-center gap-1 pt-0.5 text-muted-foreground">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={i === 0}
                          onClick={() => moveStep(app.id, step.id, -1)}
                          title="上へ"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={i === app.steps.length - 1}
                          onClick={() => moveStep(app.id, step.id, 1)}
                          title="下へ"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:text-danger"
                          onClick={() => {
                            deleteStep(app.id, step.id);
                            setEditingId(null);
                          }}
                          title="削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-primary"
                          onClick={() => setEditingId(null)}
                        >
                          <Check className="h-4 w-4" />
                          閉じる
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5">
                      <div className="flex items-center gap-2.5">
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        <StatusDot
                          status={step.status}
                          onClick={(e) => {
                            e.stopPropagation();
                            cycle(step.id, step.status);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setEditingId(step.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div
                            className={cn(
                              "min-w-0 flex-1 truncate text-sm font-medium",
                              step.status === "done" &&
                                "text-muted-foreground line-through",
                            )}
                          >
                            {STEP_KIND_LABEL[step.kind]}
                            {step.name && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                {step.name}
                              </span>
                            )}
                          </div>
                        </button>
                        {isNext ? (
                          <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                            次にやる
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {STEP_STATUS_LABEL[step.status]}
                          </span>
                        )}
                      </div>
                      {(step.dueAt || step.heldAt || step.location) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[52px] text-[11px]">
                          {step.dueAt && (
                            <span
                              className={
                                step.dueDone
                                  ? "text-muted-foreground line-through"
                                  : dueTextClass(u)
                              }
                            >
                              締切{" "}
                              {step.dueDone ? "提出済み" : relativeLabel(step.dueAt)}
                            </span>
                          )}
                          {step.dueAt && (
                            <button
                              type="button"
                              onClick={() => {
                                if (step.heldAt) {
                                  updateStep(app.id, step.id, {
                                    dueDone: !step.dueDone,
                                  });
                                } else {
                                  updateStep(app.id, step.id, {
                                    status:
                                      step.status === "done"
                                        ? "in_progress"
                                        : "done",
                                  });
                                }
                              }}
                              className={cn(
                                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                                step.dueDone
                                  ? "border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.1)] text-success"
                                  : "border-input text-muted-foreground hover:bg-muted",
                              )}
                            >
                              {step.dueDone && <Check className="h-3 w-3" />}
                              {step.dueDone ? "提出済み" : "提出した"}
                            </button>
                          )}
                          {step.heldAt && (
                            <span
                              className={
                                step.dueAt && !step.dueDone
                                  ? "text-muted-foreground"
                                  : dueTextClass(u)
                              }
                            >
                              実施 {relativeLabel(step.heldAt)}
                            </span>
                          )}
                          {step.location && (
                            <span className="text-muted-foreground">
                              {step.location}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 border-dashed bg-card"
          onClick={() => {
            const id = addStep(app.id);
            if (id) setEditingId(id);
          }}
        >
          <Plus className="h-4 w-4" />
          ステップ追加
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="bg-card">
              <LayoutTemplate className="h-4 w-4" />
              テンプレから
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {TEMPLATES.map((t) => (
              <DropdownMenuItem
                key={t.label}
                onClick={() =>
                  pristine
                    ? replaceSteps(app.id, t.kinds)
                    : addStepsBulk(app.id, t.kinds)
                }
              >
                <ListPlus className="h-4 w-4" />
                <span>
                  {t.label}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    {t.kinds.length}段
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
