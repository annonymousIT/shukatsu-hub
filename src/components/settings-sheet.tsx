"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Clock,
  Download,
  FileText,
  HelpCircle,
  LogOut,
  Palette,
  Smartphone,
  Trash2,
  Type,
  Upload,
  UserCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { FONT_OPTIONS, THEME_OPTIONS } from "@/lib/constants";
import {
  disablePush,
  enablePush,
  isIOS,
  isStandalone,
  pushSupported,
} from "@/lib/push";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NOTIFY_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6:00〜23:00

export function SettingsSheet({
  open,
  onOpenChange,
  onImport,
  onExport,
  onStartTour,
  onOpenLegal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: () => void;
  onExport: () => void;
  onStartTour: () => void;
  onOpenLegal: () => void;
}) {
  // スワイプで閉じる(event-detail と同じ作法)
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number; axis: "" | "x" | "y" }>({
    x: 0,
    y: 0,
    axis: "",
  });
  const widthRef = useRef(0);

  useEffect(() => {
    if (open) {
      setDragX(0);
      setDragging(false);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <SheetContent
        side="right"
        onTouchStart={(e) => {
          startRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            axis: "",
          };
          widthRef.current = e.currentTarget.getBoundingClientRect().width;
        }}
        onTouchMove={(e) => {
          const dx = e.touches[0].clientX - startRef.current.x;
          const dy = e.touches[0].clientY - startRef.current.y;
          if (
            !startRef.current.axis &&
            (Math.abs(dx) > 8 || Math.abs(dy) > 8)
          ) {
            startRef.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          }
          if (startRef.current.axis === "x") {
            if (!dragging) setDragging(true);
            setDragX(Math.max(0, dx));
          }
        }}
        onTouchEnd={() => {
          if (startRef.current.axis === "x") {
            setDragging(false);
            const threshold = Math.min(120, widthRef.current * 0.33);
            if (dragX > threshold) {
              setDragX(widthRef.current || 420);
              window.setTimeout(() => onOpenChange(false), 220);
            } else {
              setDragX(0);
            }
          }
          startRef.current.axis = "";
        }}
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragging ? "none" : "transform 0.22s ease-out",
        }}
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 scrollbar-thin sm:max-w-md"
      >
        <SettingsBody
          onClose={() => onOpenChange(false)}
          onImport={onImport}
          onExport={onExport}
          onStartTour={onStartTour}
          onOpenLegal={onOpenLegal}
        />
      </SheetContent>
    </Sheet>
  );
}

function SettingsBody({
  onClose,
  onImport,
  onExport,
  onStartTour,
  onOpenLegal,
}: {
  onClose: () => void;
  onImport: () => void;
  onExport: () => void;
  onStartTour: () => void;
  onOpenLegal: () => void;
}) {
  const {
    theme,
    setTheme,
    font,
    setFont,
    notify,
    setNotify,
    addPushSubscription,
    clearAll,
    applications,
    events,
  } = useStore();
  const { mode, user, signOut } = useAuth();
  const [confirmClear, setConfirmClear] = useState(false);
  const [needsHome, setNeedsHome] = useState(false);

  useEffect(() => {
    setNeedsHome(isIOS() && !isStandalone());
  }, []);

  const handleToggleNotify = async () => {
    if (notify.enabled) {
      setNotify({ enabled: false });
      await disablePush();
      toast.success("通知をオフにしました");
      return;
    }
    if (!pushSupported()) {
      toast.error("この端末は通知に対応していません");
      return;
    }
    const sub = await enablePush();
    if (!sub) {
      toast.error("通知をオンにできませんでした", {
        description:
          isIOS() && !isStandalone()
            ? "「ホーム画面に追加」してから再度お試しください"
            : "通知が許可されませんでした",
      });
      return;
    }
    addPushSubscription(sub);
    setNotify({ enabled: true });
    toast.success("通知をオンにしました");
  };

  const toggleLead = (d: number) => {
    const has = notify.leadDays.includes(d);
    const next = has
      ? notify.leadDays.filter((x) => x !== d)
      : [...notify.leadDays, d].sort((a, b) => a - b);
    setNotify({ leadDays: next.length ? next : [1] });
  };

  // プレビュー用に全フォントを読み込む(設定を開いた時だけ)
  useEffect(() => {
    FONT_OPTIONS.forEach((o) => {
      if (!o.googleHref) return;
      const id = `gf-${o.value}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = o.googleHref;
      document.head.appendChild(link);
    });
  }, []);

  const totalCount = applications.length + events.length;

  return (
    <>
      <SheetTitle className="sr-only">設定</SheetTitle>
      <div className="sticky top-0 z-20 flex items-center border-b bg-card px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-sm font-medium text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          戻る
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold">
          設定
        </span>
      </div>

      <div className="space-y-6 px-4 py-5">
        {mode === "cloud" && user?.email && (
          <Section icon={<UserCircle className="h-4 w-4" />} title="アカウント">
            <div className="rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-medium text-accent-foreground">
                  {user.email[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {user.email}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    ログイン中・クラウド同期
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  toast.success("ログアウトしました");
                }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium text-danger hover:bg-[hsl(var(--danger)/0.06)]"
              >
                <LogOut className="h-4 w-4" />
                ログアウト
              </button>
            </div>
          </Section>
        )}

        {/* 通知 */}
        <Section icon={<Bell className="h-4 w-4" />} title="通知">
          <div className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center">
              <span className="text-sm">締切・予定を通知</span>
              <button
                type="button"
                role="switch"
                aria-checked={notify.enabled}
                aria-label="通知のオン/オフ"
                onClick={handleToggleNotify}
                className={cn(
                  "relative ml-auto h-[22px] w-[38px] rounded-full transition-colors",
                  notify.enabled ? "bg-success" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all",
                    notify.enabled ? "left-[18px]" : "left-0.5",
                  )}
                />
              </button>
            </div>

            {needsHome && (
              <p className="flex items-center gap-1.5 text-[11px] text-warning">
                <Smartphone className="h-3.5 w-3.5 shrink-0" />
                iPhoneは「ホーム画面に追加」してから通知をオンにしてね
              </p>
            )}

            {notify.enabled && (
              <div className="space-y-2.5 border-t pt-3">
                <div className="text-[12px] text-muted-foreground">
                  タイミング
                </div>
                <NotifyRadio
                  checked={notify.mode === "morning"}
                  onClick={() => setNotify({ mode: "morning" })}
                  label="毎朝まとめて"
                  desc="次の予定を毎朝"
                />
                <NotifyRadio
                  checked={notify.mode === "lead"}
                  onClick={() => setNotify({ mode: "lead" })}
                  label="タイミングを指定"
                />
                {notify.mode === "lead" && (
                  <div className="flex gap-2 pl-[26px]">
                    {[3, 2, 1].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleLead(d)}
                        className={cn(
                          "rounded-lg border px-3 py-1 text-[12px] transition-colors",
                          notify.leadDays.includes(d)
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {d === 1 ? "前日" : `${d}日前`}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center border-t pt-2.5 text-sm">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  通知する時刻
                  <Select
                    value={String(notify.hour)}
                    onValueChange={(v) => setNotify({ hour: Number(v) })}
                  >
                    <SelectTrigger className="ml-auto h-8 w-[92px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTIFY_HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {h}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* テーマ */}
        <Section icon={<Palette className="h-4 w-4" />} title="テーマ">
          <div className="grid grid-cols-4 gap-2.5">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                data-theme={t.value}
                onClick={() => setTheme(t.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border bg-card p-2.5 transition-colors",
                  theme === t.value
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                <span
                  className="h-7 w-7 rounded-full ring-1 ring-inset ring-black/5"
                  style={{ background: "hsl(var(--primary))" }}
                />
                <span className="text-[11px] leading-none text-foreground">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* フォント */}
        <Section icon={<Type className="h-4 w-4" />} title="フォント">
          <div className="grid grid-cols-2 gap-2.5">
            {FONT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setFont(o.value)}
                style={{ fontFamily: o.stack }}
                className={cn(
                  "flex flex-col gap-0.5 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors",
                  font === o.value
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                <span className="text-[15px] font-medium leading-snug">
                  就活Hub
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {o.label}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* データ */}
        <Section icon={<Download className="h-4 w-4" />} title="データ">
          <div className="overflow-hidden rounded-xl border">
            <Row
              icon={<Upload className="h-4 w-4" />}
              label="インポート（JSON）"
              onClick={onImport}
            />
            <Row
              icon={<Download className="h-4 w-4" />}
              label="エクスポート（JSON）"
              onClick={onExport}
            />
            {confirmClear ? (
              <div className="flex items-center gap-2 border-t bg-[hsl(var(--danger)/0.06)] px-3 py-2.5">
                <span className="flex-1 text-[13px]">
                  全{totalCount}件を完全に削除しますか？
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClear(false)}
                >
                  やめる
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    clearAll();
                    setConfirmClear(false);
                    toast.success("全データを削除しました");
                  }}
                >
                  削除する
                </Button>
              </div>
            ) : (
              <Row
                icon={<Trash2 className="h-4 w-4" />}
                label="全データを削除"
                danger
                onClick={() => setConfirmClear(true)}
              />
            )}
          </div>
        </Section>

        {/* その他 */}
        <Section icon={<HelpCircle className="h-4 w-4" />} title="その他">
          <div className="overflow-hidden rounded-xl border">
            <Row
              icon={<HelpCircle className="h-4 w-4" />}
              label="使い方ガイド"
              onClick={() => {
                onClose();
                onStartTour();
              }}
            />
            <Row
              icon={<FileText className="h-4 w-4" />}
              label="プライバシー・利用規約"
              onClick={onOpenLegal}
            />
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 px-0.5 text-[12px] font-medium text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted/50",
        danger && "text-danger",
      )}
    >
      <span className={danger ? "text-danger" : "text-muted-foreground"}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
    </button>
  );
}

function NotifyRadio({
  checked,
  onClick,
  label,
  desc,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 text-left"
    >
      <span
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-primary" : "border-muted-foreground/40",
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="text-sm">{label}</span>
      {desc && (
        <span className="text-[11px] text-muted-foreground">{desc}</span>
      )}
    </button>
  );
}
