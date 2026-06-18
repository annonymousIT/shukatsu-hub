"use client";

import {
  Bell,
  BellRing,
  Check,
  ClipboardCheck,
  ClipboardList,
  Flower2,
  Settings,
  Sprout,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavView = "progress" | "selection" | "events" | "settings";

type Anim = "evolve" | "spin";

// 非選択→選択でアイコンの「絵そのもの」が進化する(塗り・ピル無し、色と絵だけ)
const TABS: {
  value: NavView;
  label: string;
  icon: typeof Bell;
  activeIcon: typeof Bell;
  anim: Anim;
}[] = [
  {
    value: "progress",
    label: "進捗",
    icon: Sprout, // 芽
    activeIcon: Flower2, // → 花が咲く
    anim: "evolve",
  },
  {
    value: "selection",
    label: "選考",
    icon: ClipboardList, // リスト
    activeIcon: ClipboardCheck, // → チェック付き
    anim: "evolve",
  },
  {
    value: "events",
    label: "イベント",
    icon: Bell, // ベル
    activeIcon: BellRing, // → 鳴ってる(音波)
    anim: "evolve",
  },
  {
    value: "settings",
    label: "設定",
    icon: Settings,
    activeIcon: Settings, // → クルッと一回転
    anim: "spin",
  },
];

export function BottomNav({
  view,
  onChange,
  onReTap,
  hidden = false,
}: {
  view: NavView;
  onChange: (v: NavView) => void;
  /** 現在のタブをもう一度タップしたとき(=最上部スクロール等に使う) */
  onReTap?: (v: NavView) => void;
  /** モーダル表示中は隠す(レイアウトは保持して反転リフローを防ぐ) */
  hidden?: boolean;
}) {
  return (
    <nav
      data-tour="tabs"
      className={cn(
        // 画面下に固定(flex の子だとキーボードでせり上がるので position:fixed にする)
        "fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)]",
        // モーダル(キーボード)表示中は完全に消す(iOS でせり上がるのを防ぐ)
        hidden && "hidden",
      )}
    >
      <div className="mx-auto flex max-w-3xl">
        {TABS.map((t) => {
          const active = view === t.value;
          const Icon = active ? t.activeIcon : t.icon;
          return (
            <button
              key={t.value}
              type="button"
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              onClick={() => (active ? onReTap?.(t.value) : onChange(t.value))}
              className="group relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-transform active:scale-90"
            >
              {active && t.value === "selection" ? (
                // 選考: リスト→チェック付きに進化しつつ、チェックがポンと入る
                <span
                  key="on"
                  className="relative flex h-[22px] w-[22px] items-center justify-center text-primary [transform:scale(1.1)]"
                >
                  <ClipboardList className="h-[22px] w-[22px]" strokeWidth={2.4} />
                  <Check
                    className="animate-tab-checkin absolute left-1/2 top-[57%] h-[11px] w-[11px]"
                    style={{ transform: "translate(-50%, -50%)" }}
                    strokeWidth={3.2}
                  />
                </span>
              ) : active && t.value === "events" ? (
                // イベント: 鳴ってる絵(BellRing)に進化しつつ揺れる
                <BellRing
                  key="on"
                  className="animate-tab-bell h-[22px] w-[22px] text-primary"
                  strokeWidth={2.4}
                />
              ) : (
                <Icon
                  // 選択になった瞬間に再マウントして進化アニメを毎回再生
                  key={active ? "on" : "off"}
                  className={cn(
                    "h-[22px] w-[22px]",
                    active
                      ? cn(
                          "text-primary [transform:scale(1.1)]",
                          t.anim === "spin"
                            ? "animate-tab-spin"
                            : "animate-tab-evolve",
                        )
                      : "scale-100 text-muted-foreground transition-colors duration-200 group-hover:text-foreground",
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
              )}
              <span
                className={cn(
                  "text-[10.5px] font-medium leading-none transition-colors duration-200",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
