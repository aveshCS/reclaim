import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocus } from '../features/focus/FocusContext';
import { useGym } from '../features/gym/GymContext';
import { useSettings } from '../state/SettingsContext';
import { cloudAccount, useCloudAccount } from './account';
import { pickBackup } from './backupSettings';
import { EMPTY_META, runSync, Snapshot, SyncMeta } from './sync';

export const SYNC_KEY = 'reclaim.sync.v1';
/** Wait this long after a change before uploading, so a burst of edits is one upload. */
export const SYNC_DELAY_MS = 4000;

export type SyncStatus = {
  syncing: boolean;
  lastSyncAt: number | null;
  /** Set when the last attempt failed; cleared by the next success. */
  failed: boolean;
  restoredItems: number | null;
  heldBack: number;
};

let status: SyncStatus = {
  syncing: false,
  lastSyncAt: null,
  failed: false,
  restoredItems: null,
  heldBack: 0,
};
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach(l => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => status);
}

let trigger: (() => void) | null = null;
/** "Back up now". Does nothing when signed out. */
export function syncNow() {
  trigger?.();
}

async function loadMeta(): Promise<SyncMeta> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_KEY);
    return raw
      ? { ...EMPTY_META, ...(JSON.parse(raw) as SyncMeta) }
      : EMPTY_META;
  } catch {
    return EMPTY_META;
  }
}

/** Keeps the backup up to date while signed in. Renders nothing. */
export function CloudSync() {
  const account = useCloudAccount();
  const settings = useSettings();
  const focus = useFocus();
  const gym = useGym();
  const ready = settings.ready && focus.ready && gym.ready;
  const signedIn = account.status === 'signedIn';

  useEffect(() => {
    if (account.status === 'loading') {
      cloudAccount.load();
    }
  }, [account.status]);

  // Latest app state for the runner, without restarting it on every render.
  const latest = useRef({ settings, focus, gym });
  latest.current = { settings, focus, gym };
  const running = useRef(false);
  const again = useRef(false);

  useEffect(() => {
    if (!signedIn || !ready) {
      trigger = null;
      return;
    }
    let alive = true;

    const run = async () => {
      if (running.current) {
        again.current = true;
        return;
      }
      running.current = true;
      setStatus({ syncing: true });
      try {
        let meta = await loadMeta();
        const userId = cloudAccount.userId();
        if (meta.userId !== userId) {
          meta = { ...EMPTY_META, userId }; // different account: start over
        }
        const { settings: s, focus: f, gym: g } = latest.current;
        const snap: Snapshot = {
          settings: s.settings,
          focus: f.state.history,
          attempts: g.state.attempts,
          workouts: Object.values(g.state.workouts),
        };
        const r = await runSync(cloudAccount.request, snap, meta, Date.now());
        if (!alive) {
          return;
        }
        if (r.restore) {
          if (r.restore.settings) {
            s.restoreBackup(r.restore.settings);
          }
          f.mergeRemote(r.restore.focus);
          g.mergeRemote(r.restore.attempts, r.restore.workouts);
          setStatus({
            restoredItems:
              r.restore.focus.length +
              r.restore.attempts.length +
              r.restore.workouts.length,
          });
          again.current = true; // now upload what only this phone had
        }
        if (r.focusSynced.length) {
          f.markSynced(r.focusSynced);
        }
        if (r.attemptsSynced.length) {
          g.markSynced(r.attemptsSynced);
        }
        await AsyncStorage.setItem(SYNC_KEY, JSON.stringify(r.meta));
        setStatus({
          failed: false,
          heldBack: r.heldBack,
          lastSyncAt: r.meta.lastSyncAt ?? status.lastSyncAt,
        });
      } catch {
        // Offline or signed out: everything stays on the phone and goes up next time.
        setStatus({ failed: true });
      } finally {
        running.current = false;
        setStatus({ syncing: false });
        if (again.current && alive) {
          again.current = false;
          setTimeout(run, 0);
        }
      }
    };

    trigger = run;
    run();
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        run();
      }
    });
    return () => {
      alive = false;
      trigger = null;
      sub.remove();
    };
  }, [signedIn, ready]);

  // Upload a little while after something worth backing up changes.
  const fingerprint = signedIn
    ? JSON.stringify([
        pickBackup(settings.settings),
        settings.settings.consents.length,
        focus.state.history.filter(r => r.sync === 'pending').length,
        gym.state.attempts.filter(a => a.sync === 'pending').length,
        gym.state.workouts,
      ])
    : '';
  useEffect(() => {
    if (!fingerprint || !ready) {
      return;
    }
    const t = setTimeout(() => trigger?.(), SYNC_DELAY_MS);
    return () => clearTimeout(t);
  }, [fingerprint, ready]);

  // Signed out or deleted: forget the bookkeeping so a later sign-in restores again.
  useEffect(() => {
    if (account.status === 'signedOut') {
      AsyncStorage.removeItem(SYNC_KEY).catch(() => {});
      setStatus({
        lastSyncAt: null,
        failed: false,
        restoredItems: null,
        heldBack: 0,
      });
    }
  }, [account.status]);

  return null;
}
