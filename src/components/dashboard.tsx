"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Bell,
  Check,
  HelpCircle,
  Inbox,
  ListChecks,
  Plus,
  SearchX,
  Settings,
  Upload,
} from "lucide-react";
import type { Application, Filters, Priority, SortDir, SortKey } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  getNextAction,
  hasThisWeekTask,
  situationOf,
  thisWeekTaskCount,
} from "@/lib/next-action";
import { dueInstant, dueToDate, relativeLabel, urgencyOf } from "@/lib/date";
import { exportApplications, parseBackup, readFile } from "@/lib/io";
import {
  LS_FEEDBACK_KEY,
  LS_LEGAL_KEY,
  LS_ONBOARDED_KEY,
  SAMPLE_APP_ID,
  STEP_KIND_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ControlsBar } from "@/components/controls-bar";
import { ApplicationCard } from "@/components/application-card";
import { ApplicationDetail } from "@/components/application-detail";
import { AddApplicationDialog } from "@/components/add-application-dialog";
import { AddEventDialog } from "@/components/add-event-dialog";
import { Tutorial, type TourStep } from "@/components/tutorial";
import { LegalDialog } from "@/components/legal-dialog";
import { EventsView } from "@/components/events-view";
import { EventDetail } from "@/components/event-detail";
import { SettingsSheet } from "@/components/settings-sheet";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { OnboardingPrompts } from "@/components/onboarding-prompts";

const DEFAULT_FILTERS: Filters = {
  situations: [],
  priorities: [],
  onlyThisWeek: false,
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Dashboard() {
  const store = useStore();
  const {
    applications,
    events,
    loaded,
    replaceAll,
    seedSampleIfEmpty,
    deleteApplication,
  } = store;
  const { user, mode } = useAuth();
  // 同意/オンボード済みフラグはアカウント別に持つ(同一ブラウザで複数アカウントを使っても誤って出ない問題を防ぐ)
  const flagKey = (base: string) =>
    mode === "cloud" && user ? `${base}:${user.id}` : base;

  const [view, setView] = useState<"selection" | "events">("selection");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [tourIndex, setTourIndex] = useState(-1);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalConsentMode, setLegalConsentMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [paneH, setPaneH] = useState<number | undefined>(undefined);
  const selPaneRef = useRef<HTMLDivElement>(null);
  const evPaneRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{
    x: number;
    y: number;
    axis: "" | "x" | "y";
    w: number;
  }>({ x: 0, y: 0, axis: "", w: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) return;
    // 新規(空)ユーザーのみサンプル投入。既存データには絶対に触れない(store側で多重ガード)
    seedSampleIfEmpty();
    try {
      const legalOk = !!localStorage.getItem(flagKey(LS_LEGAL_KEY));
      const onboarded = !!localStorage.getItem(flagKey(LS_ONBOARDED_KEY));
      // 実データ(サンプル除く)が無い=新規ユーザーのみチュートリアル対象。
      // 既存ユーザーには規約同意だけを流す(更新後の再同意)。
      const isNewUser =
        applications.filter((a) => a.id !== SAMPLE_APP_ID).length === 0;
      if (!legalOk) {
        setLegalConsentMode(true);
        setLegalOpen(true);
      } else if (!onboarded && isNewUser) {
        setShowOnboard(true);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, user?.id, mode]);

  const closeOnboard = () => {
    setShowOnboard(false);
    try {
      localStorage.setItem(flagKey(LS_ONBOARDED_KEY), "1");
    } catch {
      // ignore
    }
  };

  const dismissOnboard = () => {
    // 「あとで見る」= ツアーをやらない → サンプルは不要なので削除(存在しなければ無害)
    closeOnboard();
    deleteApplication(SAMPLE_APP_ID);
  };

  const acceptLegal = () => {
    try {
      localStorage.setItem(flagKey(LS_LEGAL_KEY), "1");
    } catch {
      // ignore
    }
    setLegalOpen(false);
    setLegalConsentMode(false);
    try {
      // 同意後にチュートリアルへ進むのは新規ユーザー(実データ無し)だけ
      const isNewUser =
        applications.filter((a) => a.id !== SAMPLE_APP_ID).length === 0;
      if (!localStorage.getItem(flagKey(LS_ONBOARDED_KEY)) && isNewUser)
        setShowOnboard(true);
    } catch {
      // ignore
    }
  };

  // ログイン済みユーザーに1回だけ満足度を尋ねる(規約同意後・実データのある既存ユーザー対象)
  useEffect(() => {
    if (!loaded || mode !== "cloud" || !user) return;
    try {
      if (!localStorage.getItem(flagKey(LS_LEGAL_KEY))) return;
      if (localStorage.getItem(`${LS_FEEDBACK_KEY}:${user.id}`)) return;
      const hasReal =
        applications.filter((a) => a.id !== SAMPLE_APP_ID).length > 0;
      if (!hasReal) return;
    } catch {
      return;
    }
    const t = window.setTimeout(() => setFeedbackOpen(true), 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, mode, user?.id]);

  const closeFeedback = () => {
    setFeedbackOpen(false);
    if (mode === "cloud" && user) {
      try {
        localStorage.setItem(`${LS_FEEDBACK_KEY}:${user.id}`, "1");
      } catch {
        // ignore
      }
    }
  };

  const stats = useMemo(
    () => ({
      total: applications.length,
      inProgress: applications.filter((a) => a.result === "in_progress").length,
      passed: applications.filter((a) => a.result === "passed").length,
      thisWeek: applications.reduce((n, a) => n + thisWeekTaskCount(a), 0),
    }),
    [applications],
  );

  // 同名企業が2件以上あるときだけ、カードに職種(role)を出して見分けやすくする
  const dupCompanies = useMemo(() => {
    const count = new Map<string, number>();
    for (const a of applications) {
      const c = a.company.trim();
      if (c) count.set(c, (count.get(c) ?? 0) + 1);
    }
    return new Set(
      [...count.entries()].filter(([, n]) => n >= 2).map(([c]) => c),
    );
  }, [applications]);

  const visible = useMemo(() => {
    let list = applications.filter((a) => {
      if (
        filters.situations.length &&
        !filters.situations.includes(situationOf(a))
      )
        return false;
      if (filters.priorities.length && !filters.priorities.includes(a.priority))
        return false;
      if (filters.onlyThisWeek && !hasThisWeekTask(a)) return false;
      return true;
    });
    const decorated = list.map((a) => ({ a, na: getNextAction(a) }));
    const dirMul = sortDir === "asc" ? 1 : -1;
    decorated.sort((x, y) => {
      let r: number;
      if (sort === "priority")
        r =
          PRIORITY_RANK[x.a.priority] - PRIORITY_RANK[y.a.priority] ||
          x.na.sortKey - y.na.sortKey;
      else if (sort === "name")
        r = x.a.company.localeCompare(y.a.company, "ja");
      else
        r =
          x.na.sortKey - y.na.sortKey ||
          x.a.company.localeCompare(y.a.company, "ja");
      return r * dirMul;
    });
    return decorated.map((d) => d.a);
  }, [applications, filters, sort, sortDir]);

  const tourSteps = useMemo<TourStep[]>(() => {
    const steps: TourStep[] = [
      { title: "ようこそ！", body: "操作のコツを1分でガイドするよ。" },
    ];
    if (applications.length > 0) {
      steps.push(
        {
          tour: "tabs",
          title: "選考とイベント",
          body: "上のタブで「選考」と「イベント（説明会）」を切り替え。左右にスワイプしてもOK。",
        },
        {
          tour: "card",
          title: "応募先カード",
          body: "企業ごとにカードで一覧（締切が近い順）。左の日付＝次の締切で、1週間以内は赤で強調。下のバーが進捗（色＝通過／半分＝進行中／灰＝結果待ち）。",
        },
        {
          tour: "banner",
          title: "直近の予定",
          body: "一番近い予定をここに固定表示。毎朝ここを見ればOK。",
        },
        {
          tour: "sort",
          title: "並べ替え",
          body: "カードの並び順を変更。締切順・優先度順・企業名順から選べて、右の矢印（↑↓）で昇順／降順を切り替えられる（締切順なら近い順⇄遠い順）。",
        },
        {
          tour: "filter",
          title: "絞り込み",
          body: "状況（進行中・結果待ちなど）や優先度で絞れる。",
        },
        {
          tour: "add",
          title: "企業を追加",
          body: "新しい応募先はここから。",
        },
        {
          tour: "status-dot",
          openDetail: true,
          title: "丸＝状態の切替",
          body: "この丸をタップするたびに 未着手→進行中→結果待ち→完了 と変わる。完了にすると、次のステップが自動で「次にやる」になるよ。",
        },
        {
          tour: "step",
          openDetail: true,
          title: "ステップの編集",
          body: "ステップをタップで編集（締切・場所・メモ）。左の⠿でドラッグ並べ替え。「テンプレから」で定番フローを一括追加もできる。",
        },
        {
          tour: "type",
          openDetail: true,
          title: "選考種別",
          body: "種別で合格時の表示が 内定／内々定／参加確定 に変化。インターンを選ぶと開催地も出る。",
        },
        {
          tour: "es",
          openDetail: true,
          title: "ES設問・回答",
          body: "設問と回答を保存して使い回せる。文字数カウント付き。",
        },
      );
    } else {
      steps.push({
        tour: "add",
        title: "まずは追加",
        body: "右上の＋から最初の企業を登録してみよう。",
      });
    }
    steps.push({
      title: "これで準備OK",
      body: "通知・テーマ・このガイドは、右上の設定（⚙）からいつでも開けるよ。就活がんばろう！",
    });
    return steps;
  }, [applications.length]);

  useEffect(() => {
    if (tourIndex < 0) return;
    const step = tourSteps[tourIndex];
    if (step?.openDetail) {
      if (applications[0]) setSelectedId(applications[0].id);
    } else {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourIndex]);

  // カルーセルの高さを表示中ページに追従(選考が長くてもイベントは短く保つ)
  useEffect(() => {
    const el = view === "selection" ? selPaneRef.current : evPaneRef.current;
    if (el) setPaneH(el.offsetHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, applications, events, filters, sort, sortDir, loaded]);

  const startTour = () => setTourIndex(0);
  const tourNext = () =>
    setTourIndex((i) => Math.min(i + 1, tourSteps.length - 1));
  const tourBack = () => setTourIndex((i) => Math.max(i - 1, 0));
  const tourClose = () => {
    setTourIndex(-1);
    setSelectedId(null);
    // チュートリアル終了でサンプルを自動削除(存在しなければ無害)
    deleteApplication(SAMPLE_APP_ID);
  };

  const handleAddEvent = () => setAddEventOpen(true);

  const handleExport = () => {
    if (applications.length === 0) {
      toast.info("エクスポートするデータがありません");
      return;
    }
    exportApplications(applications);
    toast.success("バックアップを書き出しました");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await readFile(file);
      const apps = parseBackup(text);
      if (
        applications.length > 0 &&
        !window.confirm(
          `現在の${applications.length}件を置き換えて ${apps.length}件 を読み込みます。続けますか？`,
        )
      )
        return;
      replaceAll(apps);
      toast.success(`${apps.length}社を読み込みました`);
    } catch (err) {
      toast.error("読み込みに失敗しました", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  if (!loaded) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-5">
        <div className="animate-app-pulse flex h-16 w-16 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-[0_8px_24px_hsl(var(--primary)/0.3)]">
          <ListChecks className="h-8 w-8" />
        </div>
        <div className="flex gap-1.5">
          <span className="animate-app-bounce h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="animate-app-bounce h-1.5 w-1.5 rounded-full bg-primary [animation-delay:0.15s]" />
          <span className="animate-app-bounce h-1.5 w-1.5 rounded-full bg-primary [animation-delay:0.3s]" />
        </div>
      </div>
    );
  }

  const now = new Date();
  const dateLabel = `${now.getMonth() + 1}/${now.getDate()} ${WD[now.getDay()]}.`;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* ヘッダー(白) */}
      <header className="shrink-0 border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <span className="text-[15px] font-semibold tracking-wide text-primary">
            {now.getMonth() + 1}/{now.getDate()}{" "}
            <span className="text-muted-foreground">{WD[now.getDay()]}.</span>
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <SaveIndicator />
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="設定"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              size="sm"
              className="h-9"
              data-tour="add"
              onClick={() =>
                view === "events" ? handleAddEvent() : setAddOpen(true)
              }
            >
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </div>
        <div className="mx-auto flex max-w-3xl" data-tour="tabs">
          <TabBtn
            active={view === "selection"}
            onClick={() => setView("selection")}
          >
            選考
          </TabBtn>
          <TabBtn active={view === "events"} onClick={() => setView("events")}>
            イベント
          </TabBtn>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-3xl pb-16 pt-4">
          <div className="px-4">
            <OnboardingPrompts
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
          <div className="overflow-hidden">
        <div
          className="flex w-[200%] items-start overflow-hidden"
          style={{
            height: paneH,
            transform: `translateX(calc(${
              view === "selection" ? "0%" : "-50%"
            } + ${dragX}px))`,
            transition: dragging
              ? "height 0.3s ease"
              : "transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1), height 0.3s ease",
          }}
          onTouchStart={(e) => {
            swipeRef.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
              axis: "",
              w: e.currentTarget.getBoundingClientRect().width / 2,
            };
          }}
          onTouchMove={(e) => {
            const dx = e.touches[0].clientX - swipeRef.current.x;
            const dy = e.touches[0].clientY - swipeRef.current.y;
            if (
              !swipeRef.current.axis &&
              (Math.abs(dx) > 8 || Math.abs(dy) > 8)
            ) {
              swipeRef.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            }
            if (swipeRef.current.axis === "x") {
              let d = dx;
              // 端方向への引っ張りには抵抗をかける
              if (view === "selection" && d > 0) d *= 0.3;
              if (view === "events" && d < 0) d *= 0.3;
              if (!dragging) setDragging(true);
              setDragX(d);
            }
          }}
          onTouchEnd={() => {
            if (swipeRef.current.axis === "x") {
              setDragging(false);
              const threshold = swipeRef.current.w * 0.25;
              if (view === "selection" && dragX < -threshold) setView("events");
              else if (view === "events" && dragX > threshold)
                setView("selection");
              setDragX(0);
            }
            swipeRef.current.axis = "";
          }}
        >
          <div ref={selPaneRef} className="w-1/2 shrink-0 px-4">
            {applications.length === 0 ? (
              <EmptyState
                onAdd={() => setAddOpen(true)}
                onImport={() => fileRef.current?.click()}
              />
            ) : (
              <>
                <p className="px-0.5 text-[13px] text-muted-foreground">
                  今週やること{" "}
                  <b className="font-semibold text-danger">
                    {stats.thisWeek}件
                  </b>{" "}
                  · 進行中 {stats.inProgress}社 · 合格 {stats.passed}社
                </p>

                <div className="mt-3">
                  <AnnouncementBanner applications={applications} />
                </div>

                <div className="mt-3">
                  <ControlsBar
                    sort={sort}
                    onSortChange={setSort}
                    dir={sortDir}
                    onDirChange={setSortDir}
                    filters={filters}
                    onFiltersChange={setFilters}
                  />
                </div>

                {visible.length === 0 ? (
                  <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
                    <SearchX className="h-7 w-7 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      条件に一致する企業がありません
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                    >
                      フィルターをリセット
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {visible.map((app, i) => (
                      <div
                        key={app.id}
                        data-tour={i === 0 ? "card" : undefined}
                      >
                        <ApplicationCard
                          app={app}
                          showRole={dupCompanies.has(app.company.trim())}
                          onOpen={() => setSelectedId(app.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div ref={evPaneRef} className="w-1/2 shrink-0 px-4">
            <EventsView
              onOpenEvent={setSelectedEventId}
              onAddEvent={handleAddEvent}
            />
          </div>
        </div>
          </div>
        </div>
      </main>

      <AddApplicationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id, name) => {
          setSelectedId(id);
          toast.success(`「${name}」を追加しました`);
        }}
      />

      <AddEventDialog
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
        onCreated={(id, name) => {
          setSelectedEventId(id);
          toast.success(`「${name}」を追加しました`);
        }}
      />

      <ApplicationDetail
        appId={selectedId}
        tourActive={tourIndex >= 0}
        onOpenChange={(o) => !o && setSelectedId(null)}
        onDeleted={(name) => {
          setSelectedId(null);
          toast.success(`「${name}」を削除しました`);
        }}
      />

      <EventDetail
        eventId={selectedEventId}
        onOpenChange={(o) => !o && setSelectedEventId(null)}
        onDeleted={(name) => {
          setSelectedEventId(null);
          toast.success(`「${name}」を削除しました`);
        }}
      />

      <OnboardingDialog
        open={showOnboard}
        onClose={dismissOnboard}
        onStartTour={() => {
          // ツアーはサンプルを使うので、ここでは削除しない(終了時 tourClose で削除)
          closeOnboard();
          startTour();
        }}
      />

      <LegalDialog
        open={legalOpen}
        onOpenChange={(o) => {
          if (!legalConsentMode) setLegalOpen(o);
        }}
        requireConsent={legalConsentMode}
        onAgree={acceptLegal}
      />

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onImport={() => fileRef.current?.click()}
        onExport={handleExport}
        onStartTour={startTour}
        onOpenLegal={() => {
          setLegalConsentMode(false);
          setLegalOpen(true);
        }}
      />

      {mode === "cloud" && user && (
        <FeedbackPrompt
          open={feedbackOpen}
          userId={user.id}
          onClose={closeFeedback}
        />
      )}

      {tourIndex >= 0 && (
        <Tutorial
          steps={tourSteps}
          index={tourIndex}
          onNext={tourNext}
          onBack={tourBack}
          onClose={tourClose}
        />
      )}
    </div>
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
        "flex-1 border-b-2 py-2.5 text-center text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SaveIndicator() {
  const { saveState, lastSavedAt } = useStore();
  if (saveState === "saving")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="relative flex h-3.5 w-3.5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary/70" />
        </span>
        <span className="hidden sm:inline">保存中</span>
      </span>
    );
  if (saveState === "saved") {
    const t = lastSavedAt ? new Date(lastSavedAt) : null;
    const hhmm = t
      ? `${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`
      : "";
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <span className="animate-app-pop flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--success)/0.15)]">
          <Check className="h-3 w-3" />
        </span>
        <span className="hidden sm:inline">保存{hhmm && ` ${hhmm}`}</span>
      </span>
    );
  }
  return null;
}

function AnnouncementBanner({ applications }: { applications: Application[] }) {
  const items = useMemo(() => {
    const up = applications
      .flatMap((app) => {
        const na = getNextAction(app);
        if (na.type !== "step" || !na.focusDate) return [];
        const inst = dueInstant(na.focusDate);
        if (inst == null) return [];
        return [
          {
            app,
            step: na.step!,
            inst,
            dueAt: na.focusDate,
            kind: na.focusKind,
          },
        ];
      })
      .sort((a, b) => a.inst - b.inst);
    if (up.length === 0) return null;
    const first = up[0];
    const d0 = dueToDate(first.dueAt);
    const sameDay = up.filter((x) => {
      const d = dueToDate(x.dueAt);
      return (
        d &&
        d0 &&
        d.getFullYear() === d0.getFullYear() &&
        d.getMonth() === d0.getMonth() &&
        d.getDate() === d0.getDate()
      );
    });
    return { first, sameDay: sameDay.slice(0, 4), date: d0 };
  }, [applications]);

  if (!items || !items.date) return null;
  const urgent = ["overdue", "soon", "near"].includes(
    urgencyOf(items.first.dueAt),
  );

  return (
    <div
      data-tour="banner"
      className={cn(
        "rounded-xl bg-card p-3 shadow-[0_1px_2px_rgba(20,28,55,0.05),0_6px_16px_rgba(20,28,55,0.05)] ring-1",
        urgent ? "ring-[hsl(var(--danger)/0.45)]" : "ring-border",
      )}
      style={{ borderLeft: "3px solid", borderLeftColor: urgent ? "hsl(var(--danger))" : "hsl(var(--primary))" }}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-medium">
        <Bell className={cn("h-3.5 w-3.5", urgent ? "text-danger" : "text-primary")} />
        <span className={urgent ? "text-danger" : "text-primary"}>直近の予定</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {items.date.getMonth() + 1}/{items.date.getDate()} ·{" "}
          {relativeLabel(items.first.dueAt)}
        </span>
      </div>
      <div className="mt-1.5 space-y-1">
        {items.sameDay.map((x) => (
          <div key={x.app.id} className="flex items-center gap-2 text-[12.5px]">
            <span
              className={cn(
                "h-1 w-1 shrink-0 rounded-full",
                urgent ? "bg-danger" : "bg-primary",
              )}
            />
            <span className="font-medium">{x.app.company || "(未設定)"}</span>
            <span className="truncate text-muted-foreground">
              {STEP_KIND_LABEL[x.step.kind]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  onAdd,
  onImport,
}: {
  onAdd: () => void;
  onImport: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Inbox className="h-7 w-7" />
      </div>
      <h2 className="mt-4 font-semibold">まだ企業が登録されていません</h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        最初の企業を追加して、選考ステップと締切を登録しよう。
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4" />
          最初の企業を追加
        </Button>
        <Button variant="outline" onClick={onImport}>
          <Upload className="h-4 w-4" />
          JSONから復元
        </Button>
      </div>
    </div>
  );
}

function OnboardingDialog({
  open,
  onClose,
  onStartTour,
}: {
  open: boolean;
  onClose: () => void;
  onStartTour: () => void;
}) {
  const steps = [
    {
      n: 1,
      t: "企業を追加",
      d: "応募先を登録（選考種別・優先度も選べる）",
    },
    {
      n: 2,
      t: "選考ステップ＆締切を入れる",
      d: "テンプレから一括もOK。「次の締切」が自動表示",
    },
    { n: 3, t: "毎朝ひらくだけ", d: "直近の予定と次にやることがトップに" },
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogTitle className="sr-only">ようこそ</DialogTitle>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Check className="h-6 w-6" />
        </div>
        <h2 className="mt-2 text-lg font-semibold">ようこそ！</h2>
        <p className="text-sm text-muted-foreground">
          就活の「次にやること」を、毎朝ここで。
        </p>
        <div className="mt-3 space-y-3 text-left">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-primary">
                {s.n}
              </div>
              <div>
                <div className="text-sm font-medium">{s.t}</div>
                <div className="text-xs text-muted-foreground">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
        <DialogDescription className="sr-only">使い方の説明</DialogDescription>
        <div className="mt-5 space-y-2">
          <Button className="w-full" onClick={onStartTour}>
            <HelpCircle className="h-4 w-4" />
            使い方を見る（1分ガイド）
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground"
          >
            あとで見る
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
