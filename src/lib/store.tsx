"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type {
  Application,
  ESEntry,
  Priority,
  RelatedLink,
  ResultStatus,
  SelectionStep,
  SelectionType,
  Theme,
} from "./types";
import { LS_KEY, LS_SEEDED_KEY, LS_THEME_KEY } from "./constants";
import { newId } from "./utils";
import { DATA_TABLE, supabase } from "./supabase";
import { normalizeApps } from "./io";
import { buildSampleApplications } from "./sample";
import { useAuth } from "./auth";

export type SaveState = "idle" | "saving" | "saved";

interface NewApplicationInput {
  company: string;
  role: string;
  priority: Priority;
  selectionType: SelectionType;
  result?: ResultStatus;
}

type AppPatch = Partial<
  Pick<
    Application,
    | "company"
    | "role"
    | "priority"
    | "result"
    | "selectionType"
    | "venueMode"
    | "venuePlace"
    | "memo"
  >
>;

interface StoreValue {
  loaded: boolean;
  applications: Application[];
  saveState: SaveState;
  lastSavedAt: number | null;
  theme: Theme;
  setTheme: (t: Theme) => void;
  addApplication: (input: NewApplicationInput) => string;
  updateApplication: (id: string, patch: AppPatch) => void;
  deleteApplication: (id: string) => void;
  addStep: (appId: string, kind?: SelectionStep["kind"]) => string | undefined;
  addStepsBulk: (appId: string, kinds: SelectionStep["kind"][]) => void;
  updateStep: (
    appId: string,
    stepId: string,
    patch: Partial<Omit<SelectionStep, "id">>,
  ) => void;
  deleteStep: (appId: string, stepId: string) => void;
  moveStep: (appId: string, stepId: string, dir: -1 | 1) => void;
  setStepOrder: (appId: string, orderedIds: string[]) => void;
  addLink: (appId: string) => string | undefined;
  updateLink: (
    appId: string,
    linkId: string,
    patch: Partial<Omit<RelatedLink, "id">>,
  ) => void;
  deleteLink: (appId: string, linkId: string) => void;
  addEsEntry: (appId: string) => string | undefined;
  updateEsEntry: (
    appId: string,
    entryId: string,
    patch: Partial<Omit<ESEntry, "id">>,
  ) => void;
  deleteEsEntry: (appId: string, entryId: string) => void;
  replaceAll: (apps: Application[]) => void;
  /** 新規(空)ユーザーにだけサンプルを投入。投入したら true。既存データは絶対に壊さない。 */
  seedSampleIfEmpty: () => boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

const nowISO = () => new Date().toISOString();

function makeStep(kind: SelectionStep["kind"] = "es"): SelectionStep {
  return {
    id: newId(),
    kind,
    name: "",
    dueAt: null,
    status: "not_started",
    location: "",
    memo: "",
  };
}

function readLocal(key: string): Application[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const apps = Array.isArray(parsed) ? parsed : parsed?.applications;
    return Array.isArray(apps) ? normalizeApps(apps) : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { mode, user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [theme, setThemeState] = useState<Theme>("indigo");
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);
  const seedTriedRef = useRef(false);

  const cacheKey = mode === "cloud" && user ? `${LS_KEY}:${user.id}` : LS_KEY;

  // ---- テーマ: 読み込み & 適用 & 保存 ----
  useEffect(() => {
    try {
      const t = localStorage.getItem(LS_THEME_KEY) as Theme | null;
      if (t) setThemeState(t);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(LS_THEME_KEY, t);
    } catch {
      // ignore
    }
  }, []);

  // ---- 初回ロード(モード別) ----
  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    seedTriedRef.current = false;
    setLoaded(false);

    (async () => {
      const cached = readLocal(cacheKey);
      if (cached && !cancelled) setApplications(cached);

      if (mode === "local" || !supabase || !user) {
        if (!cancelled) setLoaded(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from(DATA_TABLE)
          .select("data")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;

        if (data && Array.isArray(data.data)) {
          setApplications(normalizeApps(data.data));
        } else {
          const legacy = cached ?? readLocal(LS_KEY);
          if (legacy && legacy.length > 0) {
            setApplications(legacy);
            await supabase
              .from(DATA_TABLE)
              .upsert({ user_id: user.id, data: legacy, updated_at: nowISO() });
          } else {
            setApplications([]);
          }
        }
      } catch (e) {
        toast.error("クラウドからの読み込みに失敗しました", {
          description: e instanceof Error ? e.message : undefined,
        });
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user?.id]);

  // ---- 変更を 600ms デバウンスで保存 ----
  useEffect(() => {
    if (!loaded) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    dirtyRef.current = true;
    setSaveState("saving");
    const t = window.setTimeout(async () => {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ version: 1, savedAt: nowISO(), applications }),
        );
        if (mode === "cloud" && supabase && user) {
          const { error } = await supabase
            .from(DATA_TABLE)
            .upsert({ user_id: user.id, data: applications, updated_at: nowISO() });
          if (error) throw error;
        }
        dirtyRef.current = false;
        setSaveState("saved");
        setLastSavedAt(Date.now());
      } catch (e) {
        setSaveState("idle");
        toast.error("保存に失敗しました", {
          description: e instanceof Error ? e.message : undefined,
        });
      }
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications, loaded, mode, user?.id]);

  // ---- 他端末の更新を取り込む ----
  useEffect(() => {
    if (mode !== "cloud" || !supabase || !user) return;
    const pull = async () => {
      if (document.visibilityState !== "visible") return;
      if (dirtyRef.current) return;
      const { data, error } = await supabase!
        .from(DATA_TABLE)
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data || !Array.isArray(data.data)) return;
      hydratedRef.current = false;
      setApplications(normalizeApps(data.data));
    };
    document.addEventListener("visibilitychange", pull);
    window.addEventListener("focus", pull);
    return () => {
      document.removeEventListener("visibilitychange", pull);
      window.removeEventListener("focus", pull);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user?.id]);

  const mutateApp = useCallback(
    (id: string, fn: (app: Application) => Application) => {
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...fn(a), updatedAt: nowISO() } : a)),
      );
    },
    [],
  );

  const addApplication = useCallback((input: NewApplicationInput) => {
    const id = newId();
    const ts = nowISO();
    const app: Application = {
      id,
      company: input.company.trim(),
      role: input.role.trim(),
      priority: input.priority,
      result: input.result ?? "in_progress",
      selectionType: input.selectionType,
      venueMode: "",
      venuePlace: "",
      links: [],
      esEntries: [],
      memo: "",
      steps: [],
      createdAt: ts,
      updatedAt: ts,
    };
    setApplications((prev) => [app, ...prev]);
    return id;
  }, []);

  const updateApplication = useCallback<StoreValue["updateApplication"]>(
    (id, patch) => mutateApp(id, (a) => ({ ...a, ...patch })),
    [mutateApp],
  );

  const deleteApplication = useCallback((id: string) => {
    setApplications((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addStep = useCallback<StoreValue["addStep"]>(
    (appId, kind = "es") => {
      const step = makeStep(kind);
      mutateApp(appId, (a) => ({ ...a, steps: [...a.steps, step] }));
      return step.id;
    },
    [mutateApp],
  );

  const addStepsBulk = useCallback<StoreValue["addStepsBulk"]>(
    (appId, kinds) =>
      mutateApp(appId, (a) => ({
        ...a,
        steps: [...a.steps, ...kinds.map((k) => makeStep(k))],
      })),
    [mutateApp],
  );

  const updateStep = useCallback<StoreValue["updateStep"]>(
    (appId, stepId, patch) =>
      mutateApp(appId, (a) => ({
        ...a,
        steps: a.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
      })),
    [mutateApp],
  );

  const deleteStep = useCallback<StoreValue["deleteStep"]>(
    (appId, stepId) =>
      mutateApp(appId, (a) => ({
        ...a,
        steps: a.steps.filter((s) => s.id !== stepId),
      })),
    [mutateApp],
  );

  const moveStep = useCallback<StoreValue["moveStep"]>(
    (appId, stepId, dir) =>
      mutateApp(appId, (a) => {
        const idx = a.steps.findIndex((s) => s.id === stepId);
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= a.steps.length) return a;
        const steps = [...a.steps];
        [steps[idx], steps[next]] = [steps[next], steps[idx]];
        return { ...a, steps };
      }),
    [mutateApp],
  );

  const setStepOrder = useCallback<StoreValue["setStepOrder"]>(
    (appId, orderedIds) =>
      mutateApp(appId, (a) => {
        const byId = new Map(a.steps.map((s) => [s.id, s]));
        const steps = orderedIds
          .map((id) => byId.get(id))
          .filter((s): s is SelectionStep => !!s);
        // 取りこぼし防止
        for (const s of a.steps) if (!orderedIds.includes(s.id)) steps.push(s);
        return { ...a, steps };
      }),
    [mutateApp],
  );

  const addLink = useCallback<StoreValue["addLink"]>(
    (appId) => {
      const link: RelatedLink = { id: newId(), label: "", url: "" };
      mutateApp(appId, (a) => ({ ...a, links: [...a.links, link] }));
      return link.id;
    },
    [mutateApp],
  );

  const updateLink = useCallback<StoreValue["updateLink"]>(
    (appId, linkId, patch) =>
      mutateApp(appId, (a) => ({
        ...a,
        links: a.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
      })),
    [mutateApp],
  );

  const deleteLink = useCallback<StoreValue["deleteLink"]>(
    (appId, linkId) =>
      mutateApp(appId, (a) => ({
        ...a,
        links: a.links.filter((l) => l.id !== linkId),
      })),
    [mutateApp],
  );

  const addEsEntry = useCallback<StoreValue["addEsEntry"]>(
    (appId) => {
      const entry: ESEntry = {
        id: newId(),
        question: "",
        answer: "",
        charLimit: null,
      };
      mutateApp(appId, (a) => ({ ...a, esEntries: [...a.esEntries, entry] }));
      return entry.id;
    },
    [mutateApp],
  );

  const updateEsEntry = useCallback<StoreValue["updateEsEntry"]>(
    (appId, entryId, patch) =>
      mutateApp(appId, (a) => ({
        ...a,
        esEntries: a.esEntries.map((e) =>
          e.id === entryId ? { ...e, ...patch } : e,
        ),
      })),
    [mutateApp],
  );

  const deleteEsEntry = useCallback<StoreValue["deleteEsEntry"]>(
    (appId, entryId) =>
      mutateApp(appId, (a) => ({
        ...a,
        esEntries: a.esEntries.filter((e) => e.id !== entryId),
      })),
    [mutateApp],
  );

  const replaceAll = useCallback((apps: Application[]) => {
    setApplications(apps);
  }, []);

  const seedSampleIfEmpty = useCallback((): boolean => {
    // (1) クラウド取得完了まで投入しない
    if (!loaded) return false;
    // 同一マウントでの二重発火を防ぐ
    if (seedTriedRef.current) return false;
    // (2) シード済みフラグ(ユーザー別に分離)があればスキップ=全削除後も再湧きしない
    const seededKey =
      mode === "cloud" && user ? `${LS_SEEDED_KEY}:${user.id}` : LS_SEEDED_KEY;
    let already = false;
    try {
      already = !!localStorage.getItem(seededKey);
    } catch {
      // ignore
    }
    if (already) return false;
    seedTriedRef.current = true;
    try {
      localStorage.setItem(seededKey, "1");
    } catch {
      // ignore
    }
    // (3) 関数形で prev.length を再判定 → 既存データがあれば絶対に上書きしない最終防御
    let didSeed = false;
    setApplications((prev) => {
      if (prev.length > 0) return prev;
      didSeed = true;
      return buildSampleApplications();
    });
    return didSeed;
  }, [loaded, mode, user?.id]);

  const value: StoreValue = {
    loaded,
    applications,
    saveState,
    lastSavedAt,
    theme,
    setTheme,
    addApplication,
    updateApplication,
    deleteApplication,
    addStep,
    addStepsBulk,
    updateStep,
    deleteStep,
    moveStep,
    setStepOrder,
    addLink,
    updateLink,
    deleteLink,
    addEsEntry,
    updateEsEntry,
    deleteEsEntry,
    replaceAll,
    seedSampleIfEmpty,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore は StoreProvider の中で使ってください");
  return ctx;
}
