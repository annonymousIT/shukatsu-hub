"use client";

import { useEffect, useState } from "react";
import type { Priority, SelectionType } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITY_OPTIONS, SELECTION_TYPE_OPTIONS } from "@/lib/constants";

export function AddApplicationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string, name: string) => void;
}) {
  const { addApplication } = useStore();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [selectionType, setSelectionType] = useState<SelectionType>("main");

  useEffect(() => {
    if (open) {
      setCompany("");
      setRole("");
      setPriority("medium");
      setSelectionType("main");
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = company.trim();
    if (!name) return;
    const id = addApplication({ company: name, role, priority, selectionType });
    onOpenChange(false);
    onCreated(id, name);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-5 pb-7 pt-4"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
        <SheetTitle className="text-base">企業を追加</SheetTitle>
        <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
          まずは企業名だけでもOK。選考ステップは追加後に登録できます。
        </p>
        <form onSubmit={submit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="add-company">
              企業名 <span className="text-danger">*</span>
            </Label>
            <Input
              id="add-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="例: 株式会社サンプル"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-role">職種 / コース名</Label>
            <Input
              id="add-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="例: 総合職サマーインターン"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>選考種別</Label>
              <Select
                value={selectionType}
                onValueChange={(v) => setSelectionType(v as SelectionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTION_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>優先度</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={!company.trim()}>
              追加して編集
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
