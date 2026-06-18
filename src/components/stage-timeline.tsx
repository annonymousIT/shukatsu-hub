"use client";

import { useState } from "react";
import {
  Award,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  GitBranch,
  HelpCircle,
  LayoutTemplate,
  ListPlus,
  MinusCircle,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type {
  Application,
  SelectionStage,
  SelectionTask,
  StageResult,
  StepKind,
} from "@/lib/types";
import { useStore } from "@/lib/store";
import {
  STEP_KIND_ICON,
  STEP_KIND_LABEL,
  STEP_KIND_OPTIONS,
} from "@/lib/constants";
import {
  currentStage,
  taskFocusDate,
  taskFocusKind,
} from "@/lib/next-action";
import { joinDue, relativeLabel, splitDue, urgencyOf } from "@/lib/date";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TEMPLATES: { label: string; kinds: StepKind[] }[] = [
  {
    label: "本選考フル",
    kinds: ["entry", "es", "web_test", "gd", "interview", "final_interview"],
  },
  { label: "短期インターン", kinds: ["entry", "es", "interview", "internship"] },
  { label: "早期選考", kinds: ["entry", "es", "interview", "final_interview"] },
];

/** 〇トグル: 未 → 提出済(締切＋実施日が両方ある時) → 完了 */
function DoneDot({
  submitted,
  done,
  onClick,
  dataTour,
}: {
  submitted: boolean;
  done: boolean;
  onClick: (e: React.MouseEvent) => void;
  dataTour?: string;
}) {
  const title = done
    ? "完了（タップで未に戻す）"
    : submitted
      ? "提出済（タップで完了）"
      : "未（タップで提出/完了）";
  return (
    <button
      type="button"
      data-tour={dataTour}
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110",
        done
          ? "bg-amber-400 text-white"
          : submitted
            ? "border-2 border-amber-400 bg-amber-400/30"
            : "border-2 border-input bg-card",
      )}
    >
      {done && <Check className="h-3.5 w-3.5 animate-evo-stamp" />}
    </button>
  );
}

export function StageTimeline({ app }: { app: Application }) {
  const {
    addStage,
    deleteStage,
    moveStage,
    setStageResult,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskDone,
    addStagesBulk,
    replaceStages,
  } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const curId = currentStage(app)?.id ?? null;

  // 全段階が完全に手付かずならテンプレは置換、着手後は追加
  const pristine =
    app.stages.length === 0 ||
    app.stages.every(
      (s) =>
        s.result === "pending" &&
        s.tasks.every(
          (t) =>
            !t.done &&
            !t.dueAt &&
            !t.heldAt &&
            !t.name.trim() &&
            !t.location.trim() &&
            !t.memo.trim(),
        ),
    );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        {app.stages.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setEditMode((v) => !v);
              setEditingId(null);
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium",
              editMode
                ? "bg-primary text-primary-foreground"
                : "border text-primary hover:bg-accent",
            )}
          >
            {editMode ? (
              <>
                <Check className="h-3.5 w-3.5" />
                完了
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" />
                編集
              </>
            )}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          使い方
        </button>
      </div>
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      {app.stages.length === 0 ? (
        <p className="rounded-lg border border-dashed py-5 text-center text-sm text-muted-foreground">
          まだ選考段階がありません。
          <br />
          下の「段階を追加」か「テンプレから」で登録できます。
        </p>
      ) : (
        <div className="flex flex-col">
          {app.stages.map((stage, i) => (
            <div key={stage.id} data-tour={i === 0 ? "step" : undefined}>
              {i > 0 && <div className="ml-[19px] h-2.5 w-px bg-border" />}
              <StageBlock
                app={app}
                stage={stage}
                index={i}
                isCurrent={stage.id === curId}
                editMode={editMode}
                editingId={editingId}
                setEditingId={setEditingId}
                onAddTask={() => {
                  const id = addTask(app.id, stage.id);
                  if (id) setEditingId(id);
                }}
                onToggleDone={(taskId) =>
                  toggleTaskDone(app.id, stage.id, taskId)
                }
                onUpdateTask={(taskId, patch) =>
                  updateTask(app.id, stage.id, taskId, patch)
                }
                onDeleteTask={(taskId) => {
                  deleteTask(app.id, stage.id, taskId);
                  setEditingId(null);
                }}
                onSetResult={(r) => setStageResult(app.id, stage.id, r)}
                onMove={(dir) => moveStage(app.id, stage.id, dir)}
                onDelete={() => {
                  deleteStage(app.id, stage.id);
                  setEditingId(null);
                }}
                isFirst={i === 0}
                isLast={i === app.stages.length - 1}
              />
            </div>
          ))}
        </div>
      )}

      {(editMode || app.stages.length === 0) && (
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 border-dashed bg-card"
          onClick={() => {
            const id = addStage(app.id);
            if (id) {
              setEditMode(true);
              setEditingId(id);
            }
          }}
        >
          <Plus className="h-4 w-4" />
          段階を追加
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
                    ? replaceStages(app.id, t.kinds)
                    : addStagesBulk(app.id, t.kinds)
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
      )}
    </div>
  );
}

const RESULT_META: Record<
  Exclude<StageResult, "pending">,
  { label: string; icon: typeof Award; cls: string; ring: string }
> = {
  waiting: {
    label: "結果待ち",
    icon: Award,
    cls: "text-amber-600",
    ring: "ring-amber-400/50",
  },
  passed: {
    label: "通過",
    icon: Award,
    cls: "text-success",
    ring: "ring-[hsl(var(--success)/0.45)]",
  },
  failed: {
    label: "不合格",
    icon: XCircle,
    cls: "text-danger",
    ring: "ring-[hsl(var(--danger)/0.4)]",
  },
  declined: {
    label: "辞退",
    icon: MinusCircle,
    cls: "text-muted-foreground",
    ring: "ring-border",
  },
};

function StageBlock({
  app,
  stage,
  index,
  isCurrent,
  isFirst,
  isLast,
  editMode,
  editingId,
  setEditingId,
  onAddTask,
  onToggleDone,
  onUpdateTask,
  onDeleteTask,
  onSetResult,
  onMove,
  onDelete,
}: {
  app: Application;
  stage: SelectionStage;
  index: number;
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
  editMode: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onAddTask: () => void;
  onToggleDone: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<Omit<SelectionTask, "id">>) => void;
  onDeleteTask: (taskId: string) => void;
  onSetResult: (r: StageResult) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const parallel = stage.tasks.length > 1;
  const settled =
    stage.result === "passed" ||
    stage.result === "failed" ||
    stage.result === "declined";
  const meta = stage.result !== "pending" ? RESULT_META[stage.result] : null;

  return (
    <div
      className={cn(
        // 段階＝実線ブロック(独立性を明示)。現在地は primary リング、結果が出たら結果色リング
        "rounded-xl border-2 bg-card p-2.5 shadow-[0_1px_2px_rgba(20,28,55,0.04)]",
        meta
          ? cn("ring-1", meta.ring, "border-border")
          : isCurrent
            ? "border-[hsl(var(--primary)/0.45)]"
            : "border-border",
        settled && "opacity-90",
      )}
    >
      {/* 段階ヘッダー: 並行バッジ / 段階名(任意) / 現在地 */}
      <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
        <span className="text-[11px] font-semibold text-muted-foreground">
          段階 {index + 1}
        </span>
        {parallel && (
          <span className="inline-flex items-center gap-0.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
            <GitBranch className="h-3 w-3" />
            並行
          </span>
        )}
        {isCurrent && !settled && (
          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
            次にやる
          </span>
        )}
        {meta && (
          <span
            key={stage.result}
            className={cn(
              "animate-evo-rise ml-auto inline-flex items-center gap-1 text-[12px] font-semibold",
              meta.cls,
            )}
          >
            <meta.icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
        )}
        {editMode && (
          <div className={cn("flex items-center", meta ? "" : "ml-auto")}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              disabled={isFirst}
              onClick={() => onMove(-1)}
              title="上へ"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              disabled={isLast}
              onClick={() => onMove(1)}
              title="下へ"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-danger"
              onClick={onDelete}
              title="段階を削除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* タスク群 */}
      <div className="space-y-1.5">
        {stage.tasks.map((task, ti) => (
          <TaskRow
            key={task.id}
            app={app}
            task={task}
            editMode={editMode}
            dotTour={index === 0 && ti === 0 ? "status-dot" : undefined}
            editing={editingId === task.id}
            canDelete={stage.tasks.length > 1}
            onOpen={() => setEditingId(task.id)}
            onClose={() => setEditingId(null)}
            onToggleDone={() => onToggleDone(task.id)}
            onUpdate={(patch) => onUpdateTask(task.id, patch)}
            onDelete={() => onDeleteTask(task.id)}
          />
        ))}
      </div>

      {/* 並行で追加(編集モードのみ) */}
      {editMode && (
        <button
          type="button"
          onClick={onAddTask}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-primary hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          並行で追加（同時に進む選考）
        </button>
      )}

      {/* 結果コントロール */}
      <div className="mt-2 border-t pt-2">
        {settled ? (
          <button
            type="button"
            onClick={() => onSetResult("pending")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            結果を取り消す
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <ResultBtn
              label="通過"
              tone="success"
              onClick={() => onSetResult("passed")}
            />
            <ResultBtn
              label="不合格"
              tone="danger"
              onClick={() => onSetResult("failed")}
            />
            <ResultBtn
              label="辞退"
              tone="muted"
              onClick={() => onSetResult("declined")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ResultBtn({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: "success" | "danger" | "muted";
  onClick: () => void;
}) {
  const cls =
    tone === "success"
      ? "border-[hsl(var(--success)/0.4)] text-success hover:bg-[hsl(var(--success)/0.1)]"
      : tone === "danger"
        ? "border-[hsl(var(--danger)/0.4)] text-danger hover:bg-[hsl(var(--danger)/0.08)]"
        : "border-input text-muted-foreground hover:bg-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
        cls,
      )}
    >
      {label}
    </button>
  );
}

function TaskRow({
  app,
  task,
  editMode,
  editing,
  canDelete,
  dotTour,
  onOpen,
  onClose,
  onToggleDone,
  onUpdate,
  onDelete,
}: {
  app: Application;
  task: SelectionTask;
  editMode: boolean;
  editing: boolean;
  canDelete: boolean;
  dotTour?: string;
  onOpen: () => void;
  onClose: () => void;
  onToggleDone: () => void;
  onUpdate: (patch: Partial<Omit<SelectionTask, "id">>) => void;
  onDelete: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const Icon = STEP_KIND_ICON[task.kind];
  const { date, time } = splitDue(task.dueAt);
  const { date: hDate, time: hTime } = splitDue(task.heldAt);
  const focusAt = taskFocusDate(task);
  const focusKind = taskFocusKind(task);
  const u = !task.done && focusAt ? urgencyOf(focusAt) : "none";
  const urgent = u === "overdue" || u === "soon" || u === "near";

  if (editing && editMode) {
    return (
      <div className="space-y-2 rounded-lg border-2 border-[hsl(var(--primary)/0.35)] bg-card p-2.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Select
            value={task.kind}
            onValueChange={(v) => onUpdate({ kind: v as StepKind })}
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
        </div>
        <Input
          value={task.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
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
                  onUpdate({ dueAt: joinDue(e.target.value, time) })
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
                onClick={() => onUpdate({ dueAt: null })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={time}
                disabled={!date}
                onChange={(e) => onUpdate({ dueAt: joinDue(date, e.target.value) })}
                className="h-10 min-w-0 flex-1 px-2.5 text-[16px] sm:text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                disabled={!time}
                title="時刻をクリア"
                onClick={() => onUpdate({ dueAt: joinDue(date, "") })}
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
                  onUpdate({ heldAt: joinDue(e.target.value, hTime) })
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
                onClick={() => onUpdate({ heldAt: null })}
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
                  onUpdate({ heldAt: joinDue(hDate, e.target.value) })
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
                onClick={() => onUpdate({ heldAt: joinDue(hDate, "") })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {/* 場所・メモは「詳細」に折りたたみ(普段は隠して情報量を減らす) */}
        {!(showDetail || task.location.trim() || task.memo.trim()) ? (
          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            詳細（場所・メモ）
          </button>
        ) : (
          <>
            <Input
              value={task.location}
              onChange={(e) => onUpdate({ location: e.target.value })}
              placeholder="場所(任意) 例: オンライン / 東京・大手町"
              className="h-9"
            />
            <Textarea
              value={task.memo}
              onChange={(e) => onUpdate({ memo: e.target.value })}
              placeholder="メモ(任意) 例: 玉手箱形式 / GDは6人30分"
              className="min-h-[44px] resize-y text-sm"
            />
          </>
        )}
        <div className="flex items-center gap-1 pt-0.5">
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-danger"
              onClick={onDelete}
              title="このタスクを削除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-primary"
            onClick={onClose}
          >
            <Check className="h-4 w-4" />
            閉じる
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-2">
        <div className="flex items-center gap-2.5">
          <DoneDot
            submitted={!!task.submitted}
            done={task.done}
            dataTour={dotTour}
            onClick={(e) => {
              e.stopPropagation();
              onToggleDone();
            }}
          />
          <button
            type="button"
            onClick={() => editMode && onOpen()}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 text-left",
              !editMode && "cursor-default",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-medium",
                task.done && "text-muted-foreground",
              )}
            >
              {STEP_KIND_LABEL[task.kind]}
              {task.name.trim() &&
                task.name.trim() !== STEP_KIND_LABEL[task.kind] && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    {task.name}
                  </span>
                )}
            </div>
          </button>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {task.done ? "完了" : task.submitted ? "提出済" : "未"}
          </span>
        </div>
        {(task.dueAt || task.heldAt || task.location) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[34px] text-[11px]">
            {focusAt && (
              <span className={urgent ? "text-danger" : "text-muted-foreground"}>
                {focusKind === "held" ? "実施 " : "締切 "}
                {relativeLabel(focusAt)}
              </span>
            )}
            {task.location && (
              <span className="text-muted-foreground">{task.location}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 使い方ヘルプ(〇の意味・段階の結果・締切/実施日・並行)
// ============================================================
function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-base">選考フローの使い方</DialogTitle>
        <DialogDescription className="sr-only">
          段階とタスク、〇の意味、締切と実施日の違いの説明
        </DialogDescription>

        <div className="space-y-4 text-[13px] leading-relaxed">
          {/* 〇の意味 */}
          <div>
            <div className="mb-1.5 font-semibold">① 〇＝未 / 提出済 / 完了</div>
            <div className="flex items-center gap-2.5 rounded-lg bg-muted/60 p-2.5 text-[12px]">
              <div className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-input bg-card" />
                <span className="text-muted-foreground">未</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-400/30" />
                <span className="text-muted-foreground">提出済</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span>完了</span>
              </div>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              丸をタップで進む。締切と実施日が両方あるタスクは「提出済→完了」の2段階。片方だけなら一発で完了。
            </p>
          </div>

          {/* 段階の結果 */}
          <div>
            <div className="mb-1.5 font-semibold">② 段階の結果</div>
            <p className="mb-1.5 text-[12px] text-muted-foreground">
              その段階のタスクを完了したら、結果を選びます。
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--success)/0.4)] px-2 py-0.5 text-[12px] font-medium text-success">
                <Award className="h-3.5 w-3.5" />
                通過
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--danger)/0.4)] px-2 py-0.5 text-[12px] font-medium text-danger">
                <XCircle className="h-3.5 w-3.5" />
                不合格
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
                <MinusCircle className="h-3.5 w-3.5" />
                辞退
              </span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              一覧バーの色: <span className="font-medium text-success">緑=通過</span> /{" "}
              <span className="font-medium text-amber-600">黄=完了待ち</span> / 灰=未 /{" "}
              <span className="font-medium text-danger">赤=不合格</span>
            </p>
          </div>

          {/* 締切 vs 実施日 */}
          <div>
            <div className="mb-1.5 font-semibold">③ 締切と実施日のちがい</div>
            <div className="space-y-1.5 rounded-lg bg-muted/60 p-2.5">
              <div className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">締切</span>
                  ＝申請・予約・提出の期限（ESの提出期限など）
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">実施日</span>
                  ＝当日やる日（面接・GDの開催日）
                </span>
              </div>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              提出が終わると、注目日は自動で実施日に切り替わります。
            </p>
          </div>

          {/* 並行 */}
          <div>
            <div className="mb-1.5 font-semibold">④ 並行（同時に進む選考）</div>
            <p className="text-[12px] text-muted-foreground">
              ES＋Webテストのように同時に進むものは、段階内の「
              <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                <GitBranch className="h-3 w-3" />
                並行で追加
              </span>
              」で1つの段階にまとめられます。
            </p>
          </div>
        </div>

        <Button className="mt-1 w-full" onClick={() => onOpenChange(false)}>
          わかった
        </Button>
      </DialogContent>
    </Dialog>
  );
}
