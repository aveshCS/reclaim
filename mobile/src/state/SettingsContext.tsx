import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { loadSettings, saveSettings } from '../services/settingsStorage';
import {
  AgeBandId,
  AppSettings,
  DEFAULT_SETTINGS,
  ExamId,
  PriorityId,
  RoleId,
  settingsReducer,
  StruggleId,
  TrackedApp,
} from './settings';

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
  completeOnboarding: () => void;
};

const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
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
