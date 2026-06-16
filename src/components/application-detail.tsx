"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  ListChecks,
  ListPlus,
  MapPin,
  MinusCircle,
  Pencil,
  Pin,
  Plus,
  StickyNote,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";
import type { Application, VenueMode } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StepTimeline } from "@/components/step-timeline";
import {
  isInternType,
  PASSED_LABEL,
  PRIORITY_OPTIONS,
  RESULT_OPTIONS,
  SELECTION_TYPE_OPTIONS,
  STEP_KIND_LABEL,
} from "@/lib/constants";
import { getNextAction } from "@/lib/next-action";
import { formatDue, formatStamp, relativeLabel, urgencyOf } from "@/lib/date";
import { cn } from "@/lib/utils";

const VENUE_OPTIONS: { value: VenueMode; label: string }[] = [
  { value: "", label: "未設定" },
  { value: "online", label: "オンライン" },
  { value: "onsite", label: "対面" },
];

export function ApplicationDetail({
  appId,
  onOpenChange,
  onDeleted,
  tourActive = false,
}: {
  appId: string | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (name: string) => void;
  tourActive?: boolean;
}) {
  const { applications } = useStore();
  const app = applications.find((a) => a.id === appId) ?? null;
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; axis: "" | "x" | "y" }>({
    x: 0,
    y: 0,
    axis: "",
  });
  const widthRef = useRef(0);

  useEffect(() => {
    // 開く時だけリセット。閉じる(appId=null)時にリセットすると、画面外へ送ったパネルが
    // 一瞬元位置に戻ってからシートの閉じアニメが走り「ひょこっ」と戻って見えてしまう。
    if (appId) {
      setDragX(0);
      setDragging(false);
    }
  }, [appId]);

  return (
    <Sheet open={!!appId} onOpenChange={(o) => !o && onOpenChange(false)}>
      <SheetContent
        side="right"
        onInteractOutside={(e) => {
          // チュートリアル中はツールチップ操作で閉じないようにする
          if (tourActive) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (tourActive) e.preventDefault();
        }}
        onTouchStart={(e) => {
          start.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            axis: "",
          };
          widthRef.current = e.currentTarget.getBoundingClientRect().width;
        }}
        onTouchMove={(e) => {
          const dx = e.touches[0].clientX - start.current.x;
          const dy = e.touches[0].clientY - start.current.y;
          if (!start.current.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            start.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          }
          if (start.current.axis === "x") {
            if (!dragging) setDragging(true);
            setDragX(Math.max(0, dx));
          }
        }}
        onTouchEnd={() => {
          if (start.current.axis === "x") {
            setDragging(false);
            const threshold = Math.min(120, widthRef.current * 0.33);
            if (dragX > threshold) {
              setDragX(widthRef.current || 420);
              window.setTimeout(() => onOpenChange(false), 220);
            } else {
              setDragX(0);
            }
          }
          start.current.axis = "";
        }}
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragging ? "none" : "transform 0.22s ease-out",
        }}
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 scrollbar-thin sm:max-w-md"
      >
        {app ? (
          <DetailBody
            app={app}
            onClose={() => onOpenChange(false)}
            onDeleted={onDeleted}
          />
        ) : (
          <SheetTitle className="sr-only">企業詳細</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({
  app,
  onClose,
  onDeleted,
}: {
  app: Application;
  onClose: () => void;
  onDeleted: (name: string) => void;
}) {
  const {
    updateApplication,
    deleteApplication,
    addLink,
    updateLink,
    deleteLink,
    addEsEntry,
    updateEsEntry,
    deleteEsEntry,
  } = useStore();
  const [editHeader, setEditHeader] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openEs, setOpenEs] = useState<string | null>(null);
  const next = getNextAction(app);
  const intern = isInternType(app.selectionType);
  const pinnedCount = app.links.filter((l) => l.pin).length;

  return (
    <>
      <SheetTitle className="sr-only">
        {app.company || "名称未設定"} の詳細
      </SheetTitle>
      {/* ヘッダー */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-card px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-sm font-medium text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          戻る
        </button>
      </div>

      <div className="px-4 py-4">
        {/* 企業名・職種(タップ編集) */}
        {editHeader ? (
          <div className="space-y-2">
            <Input
              autoFocus
              value={app.company}
              onChange={(e) =>
                updateApplication(app.id, { company: e.target.value })
              }
              placeholder="企業名"
              className="text-base font-semibold"
            />
            <Input
              value={app.role}
              onChange={(e) =>
                updateApplication(app.id, { role: e.target.value })
              }
              placeholder="職種 / コース名"
              className="h-9 text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => setEditHeader(false)}
            >
              完了
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditHeader(true)}
            className="group block text-left"
          >
            <h2 className="text-lg font-semibold leading-tight">
              {app.company || "(名称未設定)"}
              <Pencil className="ml-1.5 inline h-3.5 w-3.5 align-baseline text-muted-foreground/50" />
            </h2>
            {app.role && (
              <p className="mt-0.5 text-sm text-muted-foreground">{app.role}</p>
            )}
          </button>
        )}

        {/* セレクト群 */}
        <div className="mt-3 space-y-2">
          <div data-tour="type">
            <LabeledSelect
              label="選考種別"
              value={app.selectionType}
              onChange={(v) =>
                updateApplication(app.id, { selectionType: v as any })
              }
              options={SELECTION_TYPE_OPTIONS}
            />
          </div>
          {intern && (
            <div className="flex gap-2">
              <div className="w-[44%]">
                <Select
                  value={app.venueMode || "none"}
                  onValueChange={(v) =>
                    updateApplication(app.id, {
                      venueMode: (v === "none" ? "" : v) as VenueMode,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <MapPin className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENUE_OPTIONS.map((o) => (
                      <SelectItem key={o.value || "none"} value={o.value || "none"}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={app.venuePlace}
                onChange={(e) =>
                  updateApplication(app.id, { venuePlace: e.target.value })
                }
                placeholder="開催地(例: 東京・渋谷)"
                disabled={app.venueMode !== "onsite"}
                className="h-9 flex-1 text-sm"
              />
            </div>
          )}
          <div className="flex gap-2">
            <div className="flex-1">
              <LabeledSelect
                label="優先度"
                value={app.priority}
                onChange={(v) =>
                  updateApplication(app.id, { priority: v as any })
                }
                options={PRIORITY_OPTIONS.map((o) => ({
                  value: o.value,
                  label: `優先度 ${o.label}`,
                }))}
              />
            </div>
            <div className="flex-1">
              <LabeledSelect
                label="結果"
                value={app.result}
                onChange={(v) => updateApplication(app.id, { result: v as any })}
                options={RESULT_OPTIONS}
              />
            </div>
          </div>
        </div>

        {/* 次にやること バナー */}
        <div className="mt-4">
          <NextBanner app={app} next={next} />
        </div>

        {/* 選考ステップ */}
        <Section icon={<ListChecks className="h-4 w-4" />} title="選考ステップ">
          <StepTimeline app={app} />
        </Section>

        {/* ES設問・回答 */}
        <Section
          icon={<Pencil className="h-4 w-4" />}
          title="ES設問・回答"
          dataTour="es"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const id = addEsEntry(app.id);
                if (id) setOpenEs(id);
              }}
            >
              <Plus className="h-4 w-4" />
              追加
            </Button>
          }
        >
          {app.esEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              設問と回答を保存して使い回せます。
            </p>
          ) : (
            <div className="space-y-2">
              {app.esEntries.map((es) => {
                const open = openEs === es.id;
                const over = es.charLimit != null && es.answer.length > es.charLimit;
                return (
                  <div
                    key={es.id}
                    className="rounded-lg border bg-card"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenEs(open ? null : es.id)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {es.question || "(設問未入力)"}
                      </span>
                      {open ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {open && (
                      <div className="space-y-2 px-3 pb-3">
                        <Input
                          value={es.question}
                          onChange={(e) =>
                            updateEsEntry(app.id, es.id, {
                              question: e.target.value,
                            })
                          }
                          placeholder="設問 例: 学生時代に力を入れたこと"
                          className="h-9 text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            文字数制限
                          </span>
                          <Input
                            type="number"
                            min={0}
                            value={es.charLimit ?? ""}
                            onChange={(e) =>
                              updateEsEntry(app.id, es.id, {
                                charLimit: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            placeholder="無制限"
                            className="h-8 w-24 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">字</span>
                        </div>
                        <Textarea
                          value={es.answer}
                          onChange={(e) =>
                            updateEsEntry(app.id, es.id, {
                              answer: e.target.value,
                            })
                          }
                          placeholder="回答を書く / 貼り付ける"
                          className="min-h-[90px] resize-y text-sm leading-relaxed"
                        />
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={cn(
                              "text-muted-foreground",
                              over && "font-medium text-danger",
                            )}
                          >
                            {es.charLimit != null
                              ? `${es.answer.length} / ${es.charLimit}字`
                              : `${es.answer.length}字`}
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="flex items-center gap-1 font-medium text-primary"
                              onClick={() => {
                                navigator.clipboard
                                  ?.writeText(es.answer)
                                  .then(() => toast.success("コピーしました"));
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              コピー
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-1 text-muted-foreground hover:text-danger"
                              onClick={() => deleteEsEntry(app.id, es.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              削除
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 関連リンク */}
        <Section
          icon={<Link2 className="h-4 w-4" />}
          title="関連リンク"
          action={
            <Button variant="ghost" size="sm" onClick={() => addLink(app.id)}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          }
        >
          {app.links.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              マイページ等のURLを登録できます。
            </p>
          ) : (
            <div className="space-y-2">
              {app.links.map((link) => (
                <div key={link.id} className="flex items-center gap-2">
                  <Input
                    value={link.label}
                    onChange={(e) =>
                      updateLink(app.id, link.id, { label: e.target.value })
                    }
                    placeholder="ラベル"
                    className="h-9 w-[34%] text-sm"
                  />
                  <Input
                    value={link.url}
                    onChange={(e) =>
                      updateLink(app.id, link.id, { url: e.target.value })
                    }
                    placeholder="https://..."
                    className="h-9 flex-1 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9 shrink-0",
                      link.pin ? "text-primary" : "text-muted-foreground",
                    )}
                    disabled={!link.pin && pinnedCount >= 2}
                    title={
                      link.pin
                        ? "ピン留め中（カードに表示）"
                        : pinnedCount >= 2
                          ? "ピンは最大2つまで"
                          : "カードにピン留め"
                    }
                    onClick={() => updateLink(app.id, link.id, { pin: !link.pin })}
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9 shrink-0",
                      !link.url && "pointer-events-none opacity-40",
                    )}
                  >
                    <a href={link.url || "#"} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-danger"
                    onClick={() => deleteLink(app.id, link.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 全体メモ */}
        <Section icon={<StickyNote className="h-4 w-4" />} title="全体メモ">
          <Textarea
            value={app.memo}
            onChange={(e) => updateApplication(app.id, { memo: e.target.value })}
            placeholder="志望動機メモ・面接の振り返り・人事の名前など自由に。"
            className="min-h-[100px] resize-y leading-relaxed"
          />
        </Section>

        {/* フッター */}
        <div className="mt-4 border-t pt-4">
          <div className="mb-3 text-[11px] text-muted-foreground">
            作成: {formatStamp(app.createdAt)} / 更新: {formatStamp(app.updatedAt)}
          </div>
          {confirmDelete ? (
            <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.06)] p-3">
              <span className="flex-1 text-sm">削除しますか？</span>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                やめる
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const name = app.company || "名称未設定";
                  deleteApplication(app.id);
                  onDeleted(name);
                }}
              >
                削除する
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              この企業を削除
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Section({
  icon,
  title,
  action,
  children,
  dataTour,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  dataTour?: string;
}) {
  return (
    <section className="mt-5" data-tour={dataTour}>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function NextBanner({
  app,
  next,
}: {
  app: Application;
  next: ReturnType<typeof getNextAction>;
}) {
  if (next.type === "result") {
    const map = {
      passed: { icon: Award, cls: "text-success", label: PASSED_LABEL[app.selectionType] },
      rejected: { icon: XCircle, cls: "text-danger", label: "不合格" },
      declined: { icon: MinusCircle, cls: "text-muted-foreground", label: "辞退" },
      in_progress: { icon: Clock, cls: "", label: "" },
    } as const;
    const r = map[app.result];
    const Icon = r.icon;
    return (
      <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3">
        <Icon className={cn("h-5 w-5", r.cls)} />
        <span className={cn("font-semibold", r.cls)}>{r.label}</span>
      </div>
    );
  }

  if (next.type !== "step") {
    const waitingStep = next.step;
    return (
      <div className="rounded-xl bg-muted px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {next.type === "waiting" ? (
            <>
              <Clock className="h-5 w-5" />
              <span className="font-medium">
                {waitingStep
                  ? `${STEP_KIND_LABEL[waitingStep.kind]}の結果待ち`
                  : "結果待ち（全ステップ完了）"}
              </span>
            </>
          ) : (
            <>
              <ListPlus className="h-5 w-5" />
              <span className="text-sm">下の「テンプレから」で選考フローを追加</span>
            </>
          )}
        </div>
      </div>
    );
  }

  const step = next.step!;
  const u = step.dueAt ? urgencyOf(step.dueAt) : "none";
  const urgent = u === "overdue" || u === "soon" || u === "near";
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 ring-1",
        urgent
          ? "bg-[hsl(var(--danger)/0.07)] ring-[hsl(var(--danger)/0.25)]"
          : "bg-accent ring-transparent",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        次にやること
      </div>
      <div className="mt-0.5 text-base font-bold leading-tight">
        {STEP_KIND_LABEL[step.kind]}
        {step.name && (
          <span className="ml-1.5 text-sm font-medium text-muted-foreground">
            {step.name}
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-1 flex items-center gap-1.5 text-sm font-medium",
          step.dueAt ? (urgent ? "text-danger" : "text-foreground/70") : "text-muted-foreground",
        )}
      >
        <CalendarDays className="h-4 w-4" />
        {step.dueAt ? (
          <span>
            {formatDue(step.dueAt)}
            <span className="mx-1 opacity-40">·</span>
            <span className="font-bold">{relativeLabel(step.dueAt)}</span>
          </span>
        ) : (
          <span>締切未設定</span>
        )}
      </div>
    </div>
  );
}
