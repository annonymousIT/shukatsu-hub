"use client";

import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHANGELOG } from "@/lib/changelog";

function fmtDate(d: string): string {
  const [y, m, dd] = d.split("-");
  return `${y}年${Number(m)}月${Number(dd)}日`;
}

/** 設定 > 更新履歴。過去の更新内容をいつでも見られる。 */
export function ChangelogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          更新履歴
        </DialogTitle>
        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {CHANGELOG.map((entry) => (
            <div key={entry.date}>
              <div className="mb-2 text-[12px] font-medium text-muted-foreground">
                {fmtDate(entry.date)}
              </div>
              <div className="space-y-2">
                {entry.items.map((it) => (
                  <div
                    key={it.title}
                    className="flex items-start gap-2.5 rounded-lg bg-muted/50 p-2.5"
                  >
                    <it.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <div className="text-[12.5px] font-medium">{it.title}</div>
                      <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                        {it.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
