"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Bell,
  Check,
  CloudOff,
  HelpCircle,
  Inbox,
  PartyPopper,
  Plus,
  RefreshCw,
  SearchX,
  Upload,
} from "lucide-react";
import type {
  Application,
  Filters,
  Priority,
  SortDir,
  SortKey,
  ViewMode,
} from "@/lib/types";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  effortSummary,
  getStageNextAction,
  hasThisWeekStageTask,
  passedToday,
  situationOf,
} from "@/lib/next-action";
import { dueInstant, dueToDate, urgencyOf } from "@/lib/date";
import { exportApplications, parseBackup, readFile } from "@/lib/io";
import {
  LS_FEEDBACK_KEY,
  LS_LEGAL_KEY,
  LS_ONBOARDED_KEY,
  LS_VIEWMODE_KEY,
  PASSED_LABEL,
  SAMPLE_APP_ID,
  STEP_KIND_LABEL,
} from "@/lib/constants";
import { CompanionComment } from "@/components/companion-comment";
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
import { SettingsPage } from "@/components/settings-sheet";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { VersionNotice } from "@/components/version-notice";
import { OnboardingPrompts } from "@/components/onboarding-prompts";
import { BottomNav, type NavView } from "@/components/bottom-nav";
import { AppLoader } from "@/components/app-loader";

const DEFAULT_FILTERS: Filters = {
  situations: [],
  priorities: [],
  onlyThisWeek: false,
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// 下タブと同じ並び。スワイプ(選考⇄イベント⇄設定)のインデックス算出に使う
const VIEWS: NavView[] = ["selection", "events", "settings"];

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

  const [view, setView] = useState<NavView>("selection");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [viewMode, setViewModeState] = useState<ViewMode>("compact");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [addSpin, setAddSpin] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [tourIndex, setTourIndex] = useState(-1);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalConsentMode, setLegalConsentMode] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const swipeRef = useRef<{
    x: number;
    y: number;
    axis: "" | "x" | "y";
    w: number;
  }>({ x: 0, y: 0, axis: "", w: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const paneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewIdxRef = useRef(0);
  const dragXRef = useRef(0);

  // 現在のタブをもう一度タップ → そのページを最上部へスムーズスクロール
  const handleReTap = (v: NavView) => {
    paneRefs.current[VIEWS.indexOf(v)]?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 表示モード(compact/detail)を端末に記憶
  const setViewMode = useCallback((m: ViewMode) => {
    setViewModeState(m);
    try {
      localStorage.setItem(LS_VIEWMODE_KEY, m);
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_VIEWMODE_KEY);
      if (v === "compact" || v === "detail") setViewModeState(v);
    } catch {
      // ignore
    }
  }, []);

  // 横スワイプ中は縦スクロールを完全ロック(非passiveで touchmove を preventDefault)
  useEffect(() => {
    viewIdxRef.current = VIEWS.indexOf(view);
  }, [view]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      swipeRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        axis: "",
        w: el.getBoundingClientRect().width / 3,
      };
      dragXRef.current = 0;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const dx = t.clientX - swipeRef.current.x;
      const dy = t.clientY - swipeRef.current.y;
      if (!swipeRef.current.axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        swipeRef.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (swipeRef.current.axis === "x") {
        // 横と確定したら縦の既定スクロールを止める=斜めでも縦に動かない
        if (e.cancelable) e.preventDefault();
        let d = dx;
        const vi = viewIdxRef.current;
        if (vi === 0 && d > 0) d *= 0.3;
        if (vi === 2 && d < 0) d *= 0.3;
        dragXRef.current = d;
        setDragging(true);
        setDragX(d);
      }
    };
    const onEnd = () => {
      if (swipeRef.current.axis === "x") {
        setDragging(false);
        const threshold = swipeRef.current.w * 0.25;
        const vi = viewIdxRef.current;
        const d = dragXRef.current;
        if (d < -threshold && vi < 2) setView(VIEWS[vi + 1]);
        else if (d > threshold && vi > 0) setView(VIEWS[vi - 1]);
        setDragX(0);
        dragXRef.current = 0;
      }
      swipeRef.current.axis = "";
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [loaded]);

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

  // 努力サマリー(積み上げ): 書類/Webテスト/面接GD の「やった」数(伴走コメントの活動量に使用)
  const effort = useMemo(() => effortSummary(applications), [applications]);
  // 伴走コメントの段階を決める活動量 = やったタスク総数 ＋ 参加済イベント数
  const companionScore = useMemo(
    () =>
      effort.docs +
      effort.webtest +
      effort.interview +
      events.filter((e) => e.status === "attended").length,
    [effort, events],
  );
  // 今日 合格(内定/内々定/参加確定)になった社(終日その日だけ祝う)。サンプルは除外。
  const celebrate = useMemo(
    () => passedToday(applications.filter((a) => a.id !== SAMPLE_APP_ID)),
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
      if (filters.onlyThisWeek && !hasThisWeekStageTask(a)) return false;
      return true;
    });
    const decorated = list.map((a) => ({ a, na: getStageNextAction(a) }));
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
          title: "選考・イベント・設定",
          body: "下のタブで「選考」「イベント（説明会）」「設定」を切り替え。選考⇄イベントは左右スワイプでもOK。",
        },
        {
          tour: "card",
          title: "応募先カード",
          body: "企業ごとにカードで一覧（締切が近い順）。左の日付＝次の締切で、1週間以内は赤で強調。詳細を開くと進捗バー（緑＝通過／黄＝完了待ち／灰＝未／赤＝不合格）。",
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
          title: "丸＝未/提出済/完了",
          body: "丸をタップで進む（締切＋実施日があるタスクは 未→提出済→完了 の2段階／片方だけなら一発で完了）。完了したら段階の「通過／不合格」を選べばOK。",
        },
        {
          tour: "step",
          openDetail: true,
          title: "段階＞タスクの編集",
          body: "段階は実線ブロック。タスクをタップで編集（締切・実施日・メモ）。「並行で追加」でES＋Webテストなど同時選考も入れられる。",
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
      body: "通知・テーマ・このガイドは、下のタブの「設定」からいつでも開けるよ。就活がんばろう！",
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
    return <AppLoader />;
  }

  const now = new Date();
  const dateLabel = `${now.getMonth() + 1}/${now.getDate()} ${WD[now.getDay()]}.`;
  const viewIdx = VIEWS.indexOf(view);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ヘッダー(白) */}
      <header className="shrink-0 border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <span className="text-[15px] font-semibold tracking-wide text-primary">
            {now.getMonth() + 1}/{now.getDate()}{" "}
            <span className="text-muted-foreground">{WD[now.getDay()]}.</span>
          </span>
          <div className="ml-auto flex items-center gap-1">
            <SaveIndicator />
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <RefreshButton />
            {/* 設定タブでは ＋ を opacity でふっと収納(レイアウトは保持) */}
            <Button
              size="icon"
              className={cn(
                "h-9 w-9 transition-opacity duration-200",
                view === "settings" && "pointer-events-none opacity-0",
              )}
              data-tour="add"
              aria-hidden={view === "settings"}
              tabIndex={view === "settings" ? -1 : 0}
              aria-label={view === "events" ? "イベントを追加" : "企業を追加"}
              onClick={() => {
                setAddSpin(true);
                window.setTimeout(() => setAddSpin(false), 500);
                view === "events" ? handleAddEvent() : setAddOpen(true);
              }}
            >
              <Plus
                className={cn("h-4.5 w-4.5", addSpin && "animate-spin-once")}
              />
            </Button>
          </div>
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden bg-background">
        {/* 3ペインを横スライド。各ページは独立スクロール(高さ同期しない=空白せり上がり無し) */}
        <div
          ref={carouselRef}
          className="flex h-full w-[300%]"
          style={{
            transform: `translateX(calc(${-viewIdx * (100 / 3)}% + ${dragX}px))`,
            transition: dragging
              ? "none"
              : "transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1)",
            // 横はJSで処理(横スクロールしない)・縦は通常スクロール。横確定時は preventDefault で縦も止める
            touchAction: "pan-y",
          }}
        >
          {/* 選考 */}
          <div
            ref={(el) => {
              paneRefs.current[0] = el;
            }}
            className={cn(
              "h-full w-1/3 shrink-0 overscroll-none scrollbar-thin",
              // 横スワイプ中は縦スクロールを物理的に止める(overflow hidden)
              dragging ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
            <div className="mx-auto max-w-3xl px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
              <OnboardingPrompts onOpenSettings={() => setView("settings")} />
              {applications.length === 0 ? (
                <EmptyState
                  onAdd={() => setAddOpen(true)}
                  onImport={() => fileRef.current?.click()}
                />
              ) : (
                <>
                  {celebrate.length > 0 && (
                    <CelebrationBanner apps={celebrate} />
                  )}

                  <CompanionComment score={companionScore} />

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
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
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
                            compact={viewMode === "compact"}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {/* イベント */}
          <div
            ref={(el) => {
              paneRefs.current[1] = el;
            }}
            className={cn(
              "h-full w-1/3 shrink-0 overscroll-none scrollbar-thin",
              // 横スワイプ中は縦スクロールを物理的に止める(overflow hidden)
              dragging ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
            <div className="mx-auto max-w-3xl px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
              <EventsView
                onOpenEvent={setSelectedEventId}
                onAddEvent={handleAddEvent}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            </div>
          </div>
          {/* 設定 */}
          <div
            ref={(el) => {
              paneRefs.current[2] = el;
            }}
            className={cn(
              "h-full w-1/3 shrink-0 overscroll-none scrollbar-thin",
              // 横スワイプ中は縦スクロールを物理的に止める(overflow hidden)
              dragging ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
            <div className="mx-auto max-w-3xl pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
              <SettingsPage
                onImport={() => fileRef.current?.click()}
                onExport={handleExport}
                onStartTour={startTour}
                onOpenLegal={() => {
                  setLegalConsentMode(false);
                  setLegalOpen(true);
                }}
                onBack={() => setView("selection")}
              />
            </div>
          </div>
        </div>
      </main>

      {/* 下タブは常時固定表示(隠さない)。モーダルは中央に出るので競合しない */}
      <BottomNav view={view} onChange={setView} onReTap={handleReTap} />

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

      {mode === "cloud" && user && (
        <FeedbackPrompt
          open={feedbackOpen}
          userId={user.id}
          onClose={closeFeedback}
        />
      )}

      {/* 選考フロー(段階＞タスク)移行の通告(移行ユーザーに1回だけ) */}
      <VersionNotice />

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

function RefreshButton() {
  const { syncNow } = useStore();
  const [spinning, setSpinning] = useState(false);
  const handle = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await syncNow();
    } finally {
      window.setTimeout(() => setSpinning(false), 600);
    }
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-muted-foreground"
      aria-label="同期"
      onClick={handle}
    >
      <RefreshCw className={cn("h-[18px] w-[18px]", spinning && "animate-spin")} />
    </Button>
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
        <span className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--success)/0.15)]">
          <Check className="animate-check-pop h-3 w-3" />
        </span>
        <span className="hidden sm:inline">保存{hhmm && ` ${hhmm}`}</span>
      </span>
    );
  }
  if (saveState === "offline") {
    // 端末には保存済み(✓)。接続が戻り次第クラウドへ自動同期する(雲がパルスで待機を表現)。
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-0.5">
          <Check className="h-3 w-3 text-success" />
          <CloudOff className="animate-app-pulse h-3.5 w-3.5" />
        </span>
        <span className="hidden sm:inline">保存済み・接続後に同期</span>
      </span>
    );
  }
  return null;
}

// 今日 合格(内定/内々定/参加確定)になった社を、その日だけ祝う(終日)。
function CelebrationBanner({ apps }: { apps: Application[] }) {
  return (
    <div className="mb-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[hsl(var(--success)/0.16)] to-[hsl(var(--primary)/0.16)] p-3.5 ring-1 ring-[hsl(var(--success)/0.4)]">
      <div className="flex items-center gap-2">
        <PartyPopper className="animate-evo-rise h-5 w-5 text-success" />
        <span className="text-[15px] font-bold">おめでとう！🎉</span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        {apps.map((a) => (
          <div key={a.id} className="text-[13px]">
            <b className="font-semibold">{a.company || "(企業)"}</b>
            <span className="ml-1.5 font-medium text-success">
              {PASSED_LABEL[a.selectionType]}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-muted-foreground">
        今日のあなた、本当によく頑張った。
      </p>
    </div>
  );
}

// 直近1週間(今日〜+7日、超過分も含む)の各社の次の予定を、日付順に固定表示。
function AnnouncementBanner({ applications }: { applications: Application[] }) {
  const items = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    const limitKey = ymd(limit);

    return applications
      .flatMap((app) => {
        const na = getStageNextAction(app);
        if (na.type !== "step" || !na.focusDate) return [];
        const day = na.focusDate.slice(0, 10);
        if (day > limitKey) return []; // 1週間より先は出さない(超過分は含む)
        const inst = dueInstant(na.focusDate);
        if (inst == null) return [];
        return [
          {
            app,
            kind: na.tasks[0]?.kind,
            dueAt: na.focusDate,
            inst,
            urgent: ["overdue", "soon", "near"].includes(
              urgencyOf(na.focusDate),
            ),
          },
        ];
      })
      .sort((a, b) => a.inst - b.inst);
  }, [applications]);

  const hasUrgent = items.some((x) => x.urgent);
  const shown = items.slice(0, 6);
  const rest = items.length - shown.length;
  const accent =
    items.length === 0
      ? "text-muted-foreground"
      : hasUrgent
        ? "text-danger"
        : "text-primary";

  return (
    <div
      data-tour="banner"
      className={cn(
        "rounded-xl bg-card p-3 shadow-[0_1px_2px_rgba(20,28,55,0.05),0_6px_16px_rgba(20,28,55,0.05)] ring-2",
        items.length === 0
          ? "ring-border"
          : hasUrgent
            ? "ring-[hsl(var(--danger)/0.6)]"
            : "ring-[hsl(var(--primary)/0.75)]",
      )}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-medium">
        <Bell className={cn("h-3.5 w-3.5", accent)} />
        <span className={accent}>直近1週間の予定</span>
        {items.length > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {items.length}件
          </span>
        )}
      </div>
      {items.length > 0 ? (
        <div className="mt-1.5 space-y-1">
          {shown.map((x) => {
            const d = dueToDate(x.dueAt);
            return (
              <div
                key={x.app.id}
                className="flex items-center gap-2.5 text-[12.5px]"
              >
                <span
                  className={cn(
                    "w-9 shrink-0 font-medium",
                    x.urgent ? "text-danger" : "text-primary",
                  )}
                >
                  {d ? `${d.getMonth() + 1}/${d.getDate()}` : "未定"}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">
                    {x.app.company || "(未設定)"}
                  </span>
                  <span className="text-muted-foreground">
                    ・{x.kind ? STEP_KIND_LABEL[x.kind] : "予定"}
                  </span>
                </span>
              </div>
            );
          })}
          {rest > 0 && (
            <div className="pl-[2.875rem] text-[11px] text-muted-foreground">
              ほか{rest}件
            </div>
          )}
        </div>
      ) : (
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          直近1週間の予定はありません
        </p>
      )}
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
