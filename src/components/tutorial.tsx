"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export interface TourStep {
  /** ハイライト対象の data-tour 値。無ければ中央表示 */
  tour?: string;
  title: string;
  body: string;
  /** このステップで企業詳細を開く必要があるか */
  openDetail?: boolean;
}

const PAD = 8;

export function Tutorial({
  steps,
  index,
  onNext,
  onBack,
  onClose,
}: {
  steps: TourStep[];
  index: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[index];

  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      if (!step.tour) {
        setRect(null);
        return;
      }
      const el = document.querySelector(
        `[data-tour="${step.tour}"]`,
      ) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "center", inline: "nearest" });
      setRect(el.getBoundingClientRect());
    };
    const t1 = window.setTimeout(measure, step.openDetail ? 430 : 80);
    const t2 = window.setTimeout(measure, step.openDetail ? 780 : 320);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onResize);
    };
  }, [step, index]);

  if (!step) return null;

  const isLast = index === steps.length - 1;

  let tipStyle: React.CSSProperties;
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = rect.bottom < vh * 0.55;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - 150, 12), vw - 312);
    tipStyle = below
      ? { top: rect.bottom + PAD + 12, left }
      : { bottom: vh - rect.top + PAD + 12, left };
  } else {
    tipStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 300,
    };
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(12,16,32,0.62)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(12,16,32,0.62)]" />
      )}

      <div
        className="fixed z-[61] w-[300px] animate-fade-in rounded-2xl bg-card p-4 shadow-2xl"
        style={tipStyle}
      >
        <div className="text-[11px] font-medium text-muted-foreground">
          {index + 1} / {steps.length}
        </div>
        <div className="mt-0.5 text-base font-semibold">{step.title}</div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            スキップ
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                戻る
              </Button>
            )}
            <Button size="sm" onClick={isLast ? onClose : onNext}>
              {isLast ? "完了" : "次へ"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
