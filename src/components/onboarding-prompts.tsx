"use client";

import { useEffect, useState } from "react";
import { Bell, Smartphone, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { isIOS, isStandalone } from "@/lib/push";

const LS_HOME_DISMISS = "shukatsu-dashboard:home-prompt-dismissed";
const LS_NOTIFY_DISMISS = "shukatsu-dashboard:notify-prompt-dismissed";

export function OnboardingPrompts({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const { notify } = useStore();
  const { mode } = useAuth();
  const [show, setShow] = useState<"home" | "notify" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const standalone = isStandalone();
      // ① iOSでホーム未追加 → ホーム追加へ誘導(これが無いと通知も使えない)
      if (
        isIOS() &&
        !standalone &&
        !localStorage.getItem(LS_HOME_DISMISS)
      ) {
        setShow("home");
        return;
      }
      // ② ホーム追加済み(=standalone)で通知未ON → 通知へ誘導
      if (
        standalone &&
        mode === "cloud" &&
        !notify.enabled &&
        !localStorage.getItem(LS_NOTIFY_DISMISS)
      ) {
        setShow("notify");
        return;
      }
      setShow(null);
    } catch {
      setShow(null);
    }
  }, [notify.enabled, mode]);

  if (!show) return null;

  if (show === "home") {
    return (
      <Banner
        icon={<Smartphone className="h-5 w-5" />}
        title="ホーム画面に追加しよう"
        body="共有ボタン（□↑）→「ホーム画面に追加」で、アプリのように使えて通知も受け取れます。"
        onDismiss={() => {
          try {
            localStorage.setItem(LS_HOME_DISMISS, "1");
          } catch {
            // ignore
          }
          setShow(null);
        }}
      />
    );
  }

  return (
    <Banner
      icon={<Bell className="h-5 w-5" />}
      title="通知をオンにしよう"
      body="締切・予定を毎日お知らせ。設定からかんたんにオンにできます。"
      actionLabel="設定を開く"
      onAction={onOpenSettings}
      onDismiss={() => {
        try {
          localStorage.setItem(LS_NOTIFY_DISMISS, "1");
        } catch {
          // ignore
        }
        setShow(null);
      }}
    />
  );
}

function Banner({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  onDismiss,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="relative mb-3 rounded-xl border border-[hsl(var(--primary)/0.3)] bg-accent p-3">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="閉じる"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-2.5">
        <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
        <div className="flex-1 pr-5">
          <div className="text-sm font-medium text-accent-foreground">
            {title}
          </div>
          <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            {body}
          </div>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
