import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { haptic } from '../../utils/haptics';
import {
  EMPTY_FOCUS,
  FocusState,
  focusReducer,
  isDue,
  Reflection,
  sanitizeFocus,
  SessionRecord,
} from './focusModel';

export const FOCUS_KEY = 'reclaim.focus.v1';

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

type FinishedInfo = { id: string; whileAway: boolean };

type FocusApi = {
  ready: boolean;
  state: FocusState;
  /** Wall clock, refreshed every second while a session is running. */
  now: number;
  /** The session that just ended and still needs (optional) reflection. */
  justFinished: FinishedInfo | null;
  start: (minutes: number, intention: string) => void;
  pause: () => void;
  resume: () => void;
  endEarly: () => void;
  reflect: (id: string, r: Reflection) => void;
  dismissFinished: () => void;
  discard: () => void;
  /** Backup bookkeeping (CloudSync). */
  markSynced: (ids: string[]) => void;
  mergeRemote: (records: SessionRecord[]) => void;
};

const Ctx = createContext<FocusApi | null>(null);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(focusReducer, EMPTY_FOCUS);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [justFinished, setJustFinished] = useState<FinishedInfo | null>(null);
  const hydrated = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Finish a running session whose time is up (possibly while the app was closed).
  const finishIfDue = useCallback((whileAway: boolean) => {
    const a = stateRef.current.active;
    const t = Date.now();
    setNow(t);
    if (a && a.status === 'running' && isDue(a, t)) {
      dispatch({ type: 'finish', now: t, early: false });
      setJustFinished({ id: a.id, whileAway });
      haptic.success();
    }
  }, []);

  // Load once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded = EMPTY_FOCUS;
      try {
        const raw = await AsyncStorage.getItem(FOCUS_KEY);
        if (raw) {
          loaded = sanitizeFocus(JSON.parse(raw));
        }
      } catch {
        loaded = EMPTY_FOCUS;
      }
      if (cancelled) {
        return;
      }
      dispatch({ type: 'hydrate', state: loaded });
      stateRef.current = loaded;
      hydrated.current = true;
      setReady(true);
      finishIfDue(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [finishIfDue]);

  // Persist every change after loading.
  useEffect(() => {
    if (!hydrated.current) {
      return;
    }
    AsyncStorage.setItem(FOCUS_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  // Tick for display only while running; timing itself comes from timestamps.
  const running = state.active?.status === 'running';
  useEffect(() => {
    if (!running) {
      return;
    }
    const i = setInterval(() => finishIfDue(false), 1000);
    return () => clearInterval(i);
  }, [running, finishIfDue]);

  // Coming back from the background: catch up immediately.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        finishIfDue(true);
      }
    });
    return () => sub.remove();
  }, [finishIfDue]);

  const api = useMemo<FocusApi>(
    () => ({
      ready,
      state,
      now,
      justFinished,
      start: (minutes, intention) => {
        const t = Date.now();
        setNow(t);
        setJustFinished(null);
        dispatch({ type: 'start', id: newId(), minutes, intention, now: t });
      },
      pause: () => dispatch({ type: 'pause', now: Date.now() }),
      resume: () => {
        const t = Date.now();
        setNow(t);
        dispatch({ type: 'resume', now: t });
      },
      endEarly: () => {
        const a = stateRef.current.active;
        dispatch({ type: 'finish', now: Date.now(), early: true });
        if (a) {
          setJustFinished({ id: a.id, whileAway: false });
        }
      },
      reflect: (id, r) => dispatch({ type: 'reflect', id, reflection: r }),
      dismissFinished: () => setJustFinished(null),
      discard: () => dispatch({ type: 'discard' }),
      markSynced: ids => dispatch({ type: 'markSynced', ids }),
      mergeRemote: records => dispatch({ type: 'mergeRemote', records }),
    }),
    [ready, state, now, justFinished],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useFocus(): FocusApi {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error('useFocus must be used inside FocusProvider');
  }
  return c;
}
