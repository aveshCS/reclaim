import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { applyBackup } from '../cloud/backupSettings';
import { loadSettings, saveSettings } from '../services/settingsStorage';
import {
  AgeBandId,
  AppSettings,
  DEFAULT_SETTINGS,
  ExamId,
  KEEP_ALIVE_MAKERS,
  platformCaps,
  PriorityId,
  RoleId,
  settingsReducer,
  StruggleId,
  TrackedApp,
  IfThenPlan,
} from './settings';
import { pauseGate } from '../native/pauseGate';

type SettingsApi = {
  /** False until persisted settings have been read. */
  ready: boolean;
  /** True if the last attempt to save failed (changes may be lost on restart). */
  saveFailed: boolean;
  settings: AppSettings;
  nextStep: () => void;
  previousStep: () => void;
  setName: (name: string) => void;
  setRole: (role: RoleId) => void;
  setExam: (exam: ExamId) => void;
  toggleStruggle: (s: StruggleId) => void;
  setAgeBand: (a: AgeBandId) => void;
  setScreenHours: (h: number) => void;
  pledge: () => void;
  togglePriority: (p: PriorityId) => void;
  setFocusMinutes: (m: number) => void;
  setMonitoringChoice: (c: 'declined' | 'requested') => void;
  setMonitoringPaused: (paused: boolean) => void;
  setTrackedApps: (apps: TrackedApp[]) => void;
  observeUsageAccess: (granted: boolean) => void;
  completePractice: (date: string) => void;
  setGate: (enabled: boolean) => void;
  setGateApps: (apps: TrackedApp[]) => void;
  setGateMinutes: (m: number) => void;
  setWeb: (enabled: boolean) => void;
  setSites: (sites: string[]) => void;
  setReels: (enabled: boolean) => void;
  setReelLimit: (limit: number) => void;
  setReelPip: (show: boolean) => void;
  setProtectChoice: (choice: 'yes' | 'later') => void;
  requestLevel: (level: 1 | 2 | 3) => void;
  startStrict: (until: number) => void;
  endStrictEarly: () => void;
  cancelPendingLevel: () => void;
  setLevelNow: (level: 1 | 2 | 3) => void;
  clearStrictNow: () => void;
  setSoundEffects: (on: boolean) => void;
  setBackupConsent: (granted: boolean) => void;
  /** Restore: put backed-up preferences onto this phone. */
  restoreBackup: (data: Record<string, unknown>) => void;
  setPlan: (p: IfThenPlan | null) => void;
  startReset: (startDate: string, limitMin: number) => void;
  setResetScore: (which: 'baseline' | 'final', score: number) => void;
  keepResetDay: (date: string, kept: boolean) => void;
  finishReset: () => void;
  abandonReset: () => void;
  completeOnboarding: () => void;
};

const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // The "win back your time" onboarding steps need the Android pause service.
  platformCaps.protect = pauseGate.isAvailable();
  platformCaps.keepAlive =
    platformCaps.protect &&
    KEEP_ALIVE_MAKERS.includes(pauseGate.maker?.() ?? '');
  const [settings, dispatch] = useReducer(settingsReducer, DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then(loaded => {
      if (cancelled) {
        return;
      }
      dispatch({ type: 'hydrate', settings: loaded });
      hydrated.current = true;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist every change, but never before the stored value has been read.
  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    saveSettings(settings).then(
      () => setSaveFailed(false),
      () => setSaveFailed(true),
    );
  }, [settings]);

  const api = useMemo<SettingsApi>(
    () => ({
      ready,
      saveFailed,
      settings,
      nextStep: () => dispatch({ type: 'nextStep' }),
      previousStep: () => dispatch({ type: 'previousStep' }),
      setName: name => dispatch({ type: 'setName', name }),
      setRole: role => dispatch({ type: 'setRole', role }),
      setExam: exam => dispatch({ type: 'setExam', exam }),
      toggleStruggle: struggle =>
        dispatch({ type: 'toggleStruggle', struggle }),
      setAgeBand: ageBand => dispatch({ type: 'setAgeBand', ageBand }),
      setScreenHours: hours => dispatch({ type: 'setScreenHours', hours }),
      pledge: () => dispatch({ type: 'pledge', at: new Date().toISOString() }),
      togglePriority: priority =>
        dispatch({ type: 'togglePriority', priority }),
      setFocusMinutes: minutes =>
        dispatch({ type: 'setFocusMinutes', minutes }),
      setMonitoringChoice: choice =>
        dispatch({
          type: 'setMonitoringChoice',
          choice,
          at: new Date().toISOString(),
        }),
      setMonitoringPaused: paused =>
        dispatch({ type: 'setMonitoringPaused', paused }),
      setTrackedApps: apps => dispatch({ type: 'setTrackedApps', apps }),
      observeUsageAccess: granted =>
        dispatch({
          type: 'observeUsageAccess',
          granted,
          at: new Date().toISOString(),
        }),
      completePractice: date => dispatch({ type: 'completePractice', date }),
      setGate: enabled =>
        dispatch({ type: 'setGate', enabled, at: new Date().toISOString() }),
      setGateApps: apps => dispatch({ type: 'setGateApps', apps }),
      setGateMinutes: minutes => dispatch({ type: 'setGateMinutes', minutes }),
      setWeb: enabled =>
        dispatch({ type: 'setWeb', enabled, at: new Date().toISOString() }),
      setSites: sites => dispatch({ type: 'setSites', sites }),
      setReels: enabled =>
        dispatch({ type: 'setReels', enabled, at: new Date().toISOString() }),
      setReelLimit: limit => dispatch({ type: 'setReelLimit', limit }),
      setReelPip: show => dispatch({ type: 'setReelPip', show }),
      setProtectChoice: choice =>
        dispatch({ type: 'setProtectChoice', choice }),
      requestLevel: level =>
        dispatch({ type: 'requestLevel', level, now: Date.now() }),
      startStrict: until =>
        dispatch({ type: 'startStrict', until, now: Date.now() }),
      endStrictEarly: () =>
        dispatch({ type: 'endStrictEarly', now: Date.now() }),
      cancelPendingLevel: () => dispatch({ type: 'cancelPendingLevel' }),
      setLevelNow: level => dispatch({ type: 'setLevelNow', level }),
      clearStrictNow: () => dispatch({ type: 'clearStrictNow' }),
      setSoundEffects: on => dispatch({ type: 'setSoundEffects', on }),
      restoreBackup: data =>
        dispatch({ type: 'hydrate', settings: applyBackup(settings, data) }),
      setBackupConsent: granted =>
        dispatch({
          type: 'setBackupConsent',
          granted,
          at: new Date().toISOString(),
        }),
      setPlan: plan => dispatch({ type: 'setPlan', plan }),
      startReset: (startDate, limitMin) =>
        dispatch({ type: 'startReset', startDate, limitMin }),
      setResetScore: (which, score) =>
        dispatch({ type: 'setResetScore', which, score }),
      keepResetDay: (date, kept) =>
        dispatch({ type: 'keepResetDay', date, kept }),
      finishReset: () =>
        dispatch({ type: 'finishReset', at: new Date().toISOString() }),
      abandonReset: () => dispatch({ type: 'abandonReset' }),
      completeOnboarding: () => dispatch({ type: 'completeOnboarding' }),
    }),
    [ready, saveFailed, settings],
  );

  return (
    <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return ctx;
}
