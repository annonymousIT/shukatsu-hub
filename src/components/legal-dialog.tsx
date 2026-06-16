"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PrivacyPolicyBody,
  TermsOfServiceBody,
} from "@/components/legal-content";

type Tab = "privacy" | "terms";

/**
 * 閲覧・初回同意 兼用の規約モーダル。
 * requireConsent=true のときは外タップ/×/Escで閉じず、「同意して始める」必須。
 */
export function LegalDialog({
  open,
  onOpenChange,
  requireConsent = false,
  onAgree,
  initialTab = "privacy",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requireConsent?: boolean;
  onAgree?: () => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!requireConsent) onOpenChange(o);
      }}
    >
      <SheetContent
        side="bottom"
        className={cn(
          "flex max-h-[85vh] flex-col rounded-t-2xl px-5 pb-6 pt-4",
          requireConsent && "[&>button]:hidden",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (requireConsent) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (requireConsent) e.preventDefault();
        }}
      >
        <div className="mx-auto mb-3 h-1 w-9 shrink-0 rounded-full bg-border" />
        <SheetTitle
          className={cn(
            requireConsent ? "text-center text-base" : "sr-only",
          )}
        >
          {requireConsent ? "ご利用の前に" : "プライバシー・利用規約"}
        </SheetTitle>
        {requireConsent && (
          <p className="mb-1 shrink-0 text-center text-xs text-muted-foreground">
            プライバシーポリシーと利用規約をご確認ください
          </p>
        )}

        <div className="mb-3 mt-2 flex shrink-0 gap-1 rounded-lg bg-muted p-1">
          <TabBtn active={tab === "privacy"} onClick={() => setTab("privacy")}>
            プライバシー
          </TabBtn>
          <TabBtn active={tab === "terms"} onClick={() => setTab("terms")}>
            利用規約
          </TabBtn>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin pr-1">
          {tab === "privacy" ? <PrivacyPolicyBody /> : <TermsOfServiceBody />}
        </div>

        <div className="mt-3 shrink-0">
          {requireConsent ? (
            <Button className="w-full" onClick={onAgree}>
              同意して始める
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              閉じる
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TabBtn({
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
        "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
