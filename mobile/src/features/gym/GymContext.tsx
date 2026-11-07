import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../../state/SettingsContext';
import { localDateKey } from '../../utils/time';
import {
  Attempt,
  DrillKind,
  EMPTY_GYM,
  GymState,
  gymReducer,
  sanitizeGym,
  workoutFor,
} from './gymModel';

export const GYM_KEY = 'reclaim.gym.v1';

type RecordInput = Omit<Attempt, 'id' | 'date' | 'at' | 'sync'>;

type GymApi = {
  ready: boolean;
  state: GymState;
  today: string;
  /** Save a graded attempt. If `inWorkout`, it also counts towards today's workout. */
  record: (a: RecordInput, inWorkout: boolean, plan?: DrillKind[]) => Attempt;
};

const Ctx = createContext<GymApi | null>(null);

export function GymProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gymReducer, EMPTY_GYM);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { completePractice } = useSettings();
  const completeRef = useRef(completePractice);
  completeRef.current = completePractice;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded = EMPTY_GYM;
      try {
        const raw = await AsyncStorage.getItem(GYM_KEY);
        if (raw) {
          loaded = sanitizeGym(JSON.parse(raw));
        }
      } catch {
        loaded = EMPTY_GYM;
      }
      if (!cancelled) {
        dispatch({ type: 'hydrate', state: loaded });
        hydrated.current = true;
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated.current) {
      AsyncStorage.setItem(GYM_KEY, JSON.stringify(state)).catch(() => {});
    }
  }, [state]);

  const today = localDateKey(Date.now());

  const api = useMemo<GymApi>(
    () => ({
      ready,
      state,
      today,
      record: (input, inWorkout, plan) => {
        const at = Date.now();
        const date = localDateKey(at);
        const attempt: Attempt = {
          ...input,
          id: `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          date,
          at,
          sync: 'pending',
        };
        const before = stateRef.current.workouts[date] ?? {
          ...workoutFor(stateRef.current, date),
          plan: plan ?? workoutFor(stateRef.current, date).plan,
        };
        dispatch({
          type: 'record',
          attempt,
          workoutDate: inWorkout ? date : null,
          plan,
        });
        const willComplete =
          inWorkout &&
          !before.completedAt &&
          before.plan.every(
            (d: DrillKind) => d === attempt.drill || before.done.includes(d),
          );
        if (willComplete) {
          completeRef.current(date);
        }
        return attempt;
      },
    }),
    [ready, state, today],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useGym(): GymApi {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error('useGym must be used inside GymProvider');
  }
  return c;
}
