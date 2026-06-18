"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  Check,
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
import { StageTimeline } from "@/components/stage-timeline";
import {
  isInternType,
  PASSED_LABEL,
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  RESULT_LABEL,
  SELECTION_TYPE_LABEL,
  SELECTION_TYPE_OPTIONS,
  STEP_KIND_LABEL,
} from "@/lib/constants";
import { getStageNextAction } from "@/lib/next-action";
import { formatDue, formatStamp, relativeLabel, urgencyOf } from "@/lib/date";
import { cn, safeHref } from "@/lib/utils";

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
  const [editBasic, setEditBasic] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editEs, setEditEs] = useState<string | null>(null);
  const [editLinks, setEditLinks] = useState(false);
  const [editMemo, setEditMemo] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const next = getStageNextAction(app);
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
        {/* 企業名・職種(タップで基本情報を編集) */}
        {!editBasic && (
          <button
            type="button"
            onClick={() => setEditBasic(true)}
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

        {/* 基本情報: 普段はバッジ表示 / ✎で編集モード(企業名・職種もここで編集) */}
        {editBasic ? (
          <div
            data-tour="type"
            className="mt-3 space-y-2 rounded-xl border-2 border-[hsl(var(--primary)/0.35)] bg-card p-3"
          >
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Pencil className="h-4 w-4 text-primary" />
              基本情報を編集
            </div>
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">企業名</div>
              <Input
                autoFocus
                value={app.company}
                onChange={(e) =>
                  updateApplication(app.id, { company: e.target.value })
                }
                placeholder="企業名"
                className="h-9 text-sm font-medium"
              />
            </div>
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">
                職種 / コース名
              </div>
              <Input
                value={app.role}
                onChange={(e) =>
                  updateApplication(app.id, { role: e.target.value })
                }
                placeholder="例: 総合職サマーインターン"
                className="h-9 text-sm"
              />
            </div>
            <LabeledSelect
              label="選考種別"
              value={app.selectionType}
              onChange={(v) =>
                updateApplication(app.id, { selectionType: v as any })
              }
              options={SELECTION_TYPE_OPTIONS}
            />
            {intern && (
              <div className="flex gap-2">
                <div className="w-[44%]">
                  <div className="mb-1 text-[11px] text-muted-foreground">
                    開催形式
                  </div>
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
                        <SelectItem
                          key={o.value || "none"}
                          value={o.value || "none"}
                        >
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <div className="mb-1 text-[11px] text-muted-foreground">
                    開催地
                  </div>
                  <Input
                    value={app.venuePlace}
                    onChange={(e) =>
                      updateApplication(app.id, { venuePlace: e.target.value })
                    }
                    placeholder="例: 東京・渋谷"
                    disabled={app.venueMode !== "onsite"}
                    className="h-9 w-full text-sm"
                  />
                </div>
              </div>
            )}
            <LabeledSelect
              label="優先度"
              value={app.priority}
              onChange={(v) => updateApplication(app.id, { priority: v as any })}
              options={PRIORITY_OPTIONS.map((o) => ({
                value: o.value,
                label: `優先度 ${o.label}`,
              }))}
            />
            <p className="text-[11px] text-muted-foreground">
              合否（通過・不合格・辞退）は下の選考フローで各段階ごとに設定します。
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setEditBasic(false);
                toast.success("保存しました");
              }}
            >
              <Check className="h-4 w-4" />
              保存
            </Button>
          </div>
        ) : (
          <div
            data-tour="type"
            className="mt-3 flex flex-wrap items-center gap-1.5"
          >
            <InfoBadge>{SELECTION_TYPE_LABEL[app.selectionType]}</InfoBadge>
            <InfoBadge tone={app.priority === "high" ? "accent" : "default"}>
              優先度 {PRIORITY_LABEL[app.priority]}
            </InfoBadge>
            <InfoBadge
              tone={
                app.result === "passed"
                  ? "success"
                  : app.result === "rejected"
                    ? "danger"
                    : "default"
              }
            >
              {app.result === "passed"
                ? PASSED_LABEL[app.selectionType]
                : RESULT_LABEL[app.result]}
            </InfoBadge>
            {intern && app.venueMode && (
              <InfoBadge>
                <MapPin className="h-3 w-3" />
                {app.venueMode === "online"
                  ? "オンライン"
                  : `対面${app.venuePlace ? ` · ${app.venuePlace}` : ""}`}
              </InfoBadge>
            )}
          </div>
        )}

        {/* 次にやること バナー */}
        <div className="mt-4">
          <NextBanner app={app} next={next} />
        </div>

        {/* 選考フロー(段階＞タスク) */}
        <Section icon={<ListChecks className="h-4 w-4" />} title="選考フロー">
          <StageTimeline app={app} />
        </Section>

        {/* ES設問・回答: 読み物表示 / 個別✎編集 */}
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
                if (id) setEditEs(id);
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
                const over =
                  es.charLimit != null && es.answer.length > es.charLimit;
                const counter =
                  es.charLimit != null
                    ? `${es.answer.length} / ${es.charLimit}字`
                    : `${es.answer.length}字`;
                if (editEs === es.id) {
                  return (
                    <div
                      key={es.id}
                      className="space-y-2 rounded-lg border-2 border-[hsl(var(--primary)/0.35)] bg-card p-3"
                    >
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
                        className="min-h-[110px] resize-y text-sm leading-relaxed"
                      />
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-xs text-muted-foreground",
                            over && "font-medium text-danger",
                          )}
                        >
                          {counter}
                        </span>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-danger"
                          onClick={() => {
                            deleteEsEntry(app.id, es.id);
                            setEditEs(null);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          削除
                        </button>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => {
                          setEditEs(null);
                          toast.success("保存しました");
                        }}
                      >
                        <Check className="h-4 w-4" />
                        保存
                      </Button>
                    </div>
                  );
                }
                return (
                  <div key={es.id} className="rounded-lg border bg-card p-3">
                    <div className="text-sm font-medium">
                      {es.question || "(設問未入力)"}
                    </div>
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                      {es.answer || "(回答未入力)"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span
                        className={cn(
                          "text-muted-foreground",
                          over && "font-medium text-danger",
                        )}
                      >
                        {counter}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className={cn(
                            "flex items-center gap-1 font-medium",
                            copiedId === es.id ? "text-success" : "text-primary",
                          )}
                          onClick={() => {
                            navigator.clipboard
                              ?.writeText(es.answer)
                              .then(() => {
                                toast.success("コピーしました");
                                setCopiedId(es.id);
                                window.setTimeout(
                                  () =>
                                    setCopiedId((c) =>
                                      c === es.id ? null : c,
                                    ),
                                  1300,
                                );
                              });
                          }}
                        >
                          {copiedId === es.id ? (
                            <>
                              <Check
                                key="copied"
                                className="animate-evo-flip h-3.5 w-3.5"
                              />
                              コピー済
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              コピー
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-muted-foreground"
                          onClick={() => setEditEs(es.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          編集
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 関連リンク: 飛ぶボタン表示 / ✎全体編集(飛ぶと編集を分離) */}
        <Section
          icon={<Link2 className="h-4 w-4" />}
          title="関連リンク"
          action={
            <div className="flex items-center gap-1">
              {app.links.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (editLinks) toast.success("保存しました");
                    setEditLinks((v) => !v);
                  }}
                >
                  {editLinks ? (
                    <>
                      <Check className="h-4 w-4" />
                      完了
                    </>
                  ) : (
                    <>
                      <Pencil className="h-4 w-4" />
                      編集
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  addLink(app.id);
                  setEditLinks(true);
                }}
              >
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
          }
        >
          {app.links.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              マイページ等のURLを登録できます。
            </p>
          ) : editLinks ? (
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
                      "h-9 w-9 shrink-0 transition-all",
                      link.pin
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-input text-muted-foreground hover:bg-accent",
                    )}
                    disabled={!link.pin && pinnedCount >= 2}
                    title={
                      link.pin
                        ? "ピン留め中（カードに表示）・タップで解除"
                        : pinnedCount >= 2
                          ? "ピンは最大2つまで"
                          : "カードにピン留め"
                    }
                    onClick={() => updateLink(app.id, link.id, { pin: !link.pin })}
                  >
                    <Pin
                      key={link.pin ? "on" : "off"}
                      className={cn(
                        "h-4 w-4",
                        link.pin && "animate-evo-drop fill-current",
                      )}
                    />
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
          ) : (
            <div className="flex flex-wrap gap-2">
              {app.links.map((link) => (
                <a
                  key={link.id}
                  href={safeHref(link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-[13px] font-medium text-primary",
                    !link.url && "pointer-events-none opacity-40",
                  )}
                >
                  {link.pin && <Pin className="h-3.5 w-3.5" />}
                  <span className="max-w-[12rem] truncate">
                    {link.label || "リンク"}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </a>
              ))}
            </div>
          )}
        </Section>

        {/* 全体メモ: 表示 / ✎編集 */}
        <Section
          icon={<StickyNote className="h-4 w-4" />}
          title="全体メモ"
          action={
            app.memo && !editMemo ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditMemo(true)}
              >
                <Pencil className="h-4 w-4" />
                編集
              </Button>
            ) : null
          }
        >
          {app.memo && !editMemo ? (
            <button
              type="button"
              onClick={() => setEditMemo(true)}
              className="w-full whitespace-pre-wrap rounded-lg border bg-card p-3 text-left text-[13px] leading-relaxed"
            >
              {app.memo}
            </button>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={app.memo}
                onChange={(e) =>
                  updateApplication(app.id, { memo: e.target.value })
                }
                placeholder="志望動機メモ・面接の振り返り・人事の名前など自由に。"
                className="min-h-[100px] resize-y leading-relaxed"
              />
              {app.memo && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setEditMemo(false);
                    toast.success("保存しました");
                  }}
                >
                  <Check className="h-4 w-4" />
                  保存
                </Button>
              )}
            </div>
          )}
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

function InfoBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "danger" | "accent";
}) {
  const cls =
    tone === "success"
      ? "bg-[hsl(var(--success)/0.14)] text-success ring-[hsl(var(--success)/0.4)]"
      : tone === "danger"
        ? "bg-[hsl(var(--danger)/0.1)] text-danger ring-[hsl(var(--danger)/0.4)]"
        : tone === "accent"
          ? "bg-accent text-accent-foreground ring-[hsl(var(--accent-foreground)/0.3)]"
          : "bg-secondary text-foreground ring-[hsl(var(--muted-foreground)/0.32)]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ring-1 ring-inset",
        cls,
      )}
    >
      {children}
    </span>
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
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground [&_svg]:text-muted-foreground">
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
  next: ReturnType<typeof getStageNextAction>;
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
    return (
      <div className="rounded-xl bg-muted px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {next.type === "waiting" ? (
            <>
              <Clock className="h-5 w-5" />
              <span className="font-medium">結果待ち</span>
            </>
          ) : (
            <>
              <ListPlus className="h-5 w-5" />
              <span className="text-sm">下の「段階を追加」で選考フローを登録</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // 次にやるタスク(並行なら複数)
  const focus = next.focusDate;
  const kindLabel = next.focusKind === "held" ? "実施" : "締切";
  const u = focus ? urgencyOf(focus) : "none";
  const urgent = u === "overdue" || u === "soon" || u === "near";
  const parallel = next.tasks.length > 1;
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
        次にやること{parallel && "（並行）"}
      </div>
      <div className="mt-0.5 text-base font-bold leading-tight">
        {next.tasks.map((t) => STEP_KIND_LABEL[t.kind]).join(" ・ ")}
      </div>
      {/* サブタイトル(補足名)とメモは一段下に薄く */}
      {next.tasks.map((t) =>
        t.name.trim() || t.memo.trim() ? (
          <div key={t.id} className="mt-0.5">
            {t.name.trim() && (
              <div className="text-[12.5px] text-muted-foreground">
                {t.name}
              </div>
            )}
            {t.memo.trim() && (
              <div className="line-clamp-2 whitespace-pre-wrap text-[11.5px] text-muted-foreground/75">
                {t.memo}
              </div>
            )}
          </div>
        ) : null,
      )}
      <div
        className={cn(
          "mt-1 flex items-center gap-1.5 text-sm font-medium",
          focus
            ? urgent
              ? "text-danger"
              : "text-foreground/70"
            : "text-muted-foreground",
        )}
      >
        <CalendarDays className="h-4 w-4" />
        {focus ? (
          <span>
            <span className="text-[11px] opacity-70">{kindLabel}</span>{" "}
            {formatDue(focus)}
            <span className="mx-1 opacity-40">·</span>
            <span className="font-bold">{relativeLabel(focus)}</span>
          </span>
        ) : (
          <span>日程未設定</span>
        )}
      </div>
    </div>
  );
}
