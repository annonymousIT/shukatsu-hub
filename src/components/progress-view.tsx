"use client";

import { useMemo } from "react";
import {
  Building2,
  ClipboardList,
  FileText,
  Flame,
  Flower2,
  Footprints,
  Leaf,
  Lock,
  MessagesSquare,
  Sprout,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { effortSummary } from "@/lib/next-action";
import { progressPhrase } from "@/components/companion-comment";
import { cn } from "@/lib/utils";

// 努力(歩数)で花畑が育つ。花＝テーマ色(primary)の濃淡 / 葉・地面＝緑。
// 0=芽だけ / 1〜9=数輪 / 10〜24=そこそこ / 25〜44=にぎやか / 45〜=満開
function flowerCount(total: number): number {
  if (total <= 0) return 0;
  if (total <= 9) return 3;
  if (total <= 24) return 5;
  if (total <= 44) return 7;
  return 9;
}

const SIZES = [26, 34, 22, 30, 24, 36, 21, 32, 27];
const OPACITIES = [1, 0.85, 0.7, 0.95, 0.78, 1, 0.72, 0.9, 0.82];

function FlowerField({ total }: { total: number }) {
  const count = flowerCount(total);
  if (count === 0) {
    return (
      <div className="flex h-[60px] items-end justify-center">
        <Sprout className="text-success" size={40} />
      </div>
    );
  }
  return (
    <div className="flex h-[60px] items-end justify-center gap-0.5">
      {Array.from({ length: count }, (_, i) => {
        const size = SIZES[i % SIZES.length];
        if (i % 3 === 1) {
          return (
            <Sprout key={i} className="text-success" size={Math.round(size * 0.8)} />
          );
        }
        return (
          <Flower2
            key={i}
            className="text-primary"
            size={size}
            style={{ opacity: OPACITIES[i % OPACITIES.length] }}
          />
        );
      })}
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-[17px] w-[17px] text-primary" />
        <span className="text-2xl font-semibold">{value}</span>
      </div>
      <div className="mt-1 text-[12px] text-muted-foreground">{label}</div>
    </div>
  );
}

interface Badge {
  icon: LucideIcon;
  name: string;
  hint: string;
  done: boolean;
}

export function ProgressView() {
  const { applications, events } = useStore();
  const effort = useMemo(() => effortSummary(applications), [applications]);
  const attended = useMemo(
    () => events.filter((e) => e.status === "attended").length,
    [events],
  );
  const total = effort.docs + effort.webtest + effort.interview + attended;

  const badges: Badge[] = [
    { icon: Footprints, name: "はじめの一歩", hint: "計1", done: total >= 1 },
    { icon: FileText, name: "ES職人", hint: "ES5", done: effort.docs >= 5 },
    {
      icon: MessagesSquare,
      name: "場数の人",
      hint: "面接5",
      done: effort.interview >= 5,
    },
    { icon: Users, name: "情報通", hint: "説明会5", done: attended >= 5 },
    { icon: Flame, name: "コツコツ", hint: "計20", done: total >= 20 },
    { icon: Flower2, name: "満開", hint: "計45", done: total >= 45 },
  ];
  const earned = badges.filter((b) => b.done).length;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <h1 className="mb-3 px-0.5 text-[15px] font-semibold">積み上げ</h1>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(20,28,55,0.05),0_6px_16px_rgba(20,28,55,0.05)]">
        {/* 花畑ヒーロー(緑の囲い・角丸の中に花＋地面、歩数と一言は白地に) */}
        <div className="px-4 pt-4">
          <div className="overflow-hidden rounded-xl bg-[hsl(var(--success)/0.1)] px-3 pt-3">
            <FlowerField total={total} />
            <div className="h-2.5 rounded-t-md bg-[hsl(var(--success)/0.35)]" />
          </div>
          <div className="mt-3 flex items-end justify-center gap-1.5">
            <span className="text-[34px] font-semibold leading-none">{total}</span>
            <span className="pb-0.5 text-[13px] text-muted-foreground">
              歩、動いた
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5 pt-1.5 text-[12.5px] text-muted-foreground">
            <Leaf className="h-3.5 w-3.5 text-success" />
            {progressPhrase(total)}
          </div>
        </div>

        {/* 指標(積み上げ) */}
        <div className="grid grid-cols-2 gap-2.5 p-4">
          <Metric icon={FileText} value={effort.docs} label="ES提出" />
          <Metric icon={Users} value={attended} label="説明会・イベント" />
          <Metric icon={ClipboardList} value={effort.webtest} label="Webテスト" />
          <Metric icon={MessagesSquare} value={effort.interview} label="面接・GD" />
          <Metric icon={Building2} value={applications.length} label="関わった企業" />
        </div>

        {/* 称号 */}
        <div className="border-t px-4 py-4">
          <div className="mb-2.5 text-[12px] text-muted-foreground">
            称号（あつめた {earned}/{badges.length}）
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {badges.map((b) => {
              const Icon = b.done ? b.icon : Lock;
              return (
                <div
                  key={b.name}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center",
                    b.done
                      ? "bg-[hsl(var(--primary)/0.1)] text-primary"
                      : "bg-muted/60 text-muted-foreground/70",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-tight">
                    {b.name}
                  </span>
                  {!b.done && (
                    <span className="text-[9px] leading-none text-muted-foreground/60">
                      {b.hint}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
