import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { usageStats } from '../../native/usageStats';
import { useSettings } from '../../state/SettingsContext';

export type AccessStatus = 'unavailable' | 'checking' | 'granted' | 'denied';

/**
 * Current Usage Access state. Re-checked whenever the app returns to the foreground,
 * because the user can grant or revoke it in Android Settings at any time.
 */
export function useUsageAccess() {
  const { settings, observeUsageAccess } = useSettings();
  const [status, setStatus] = useState<AccessStatus>(
    usageStats.isAvailable() ? 'checking' : 'unavailable',
  );
  const observeRef = useRef(observeUsageAccess);
  observeRef.current = observeUsageAccess;

  const check = useCallback(async () => {
    if (!usageStats.isAvailable()) {
      setStatus('unavailable');
      return;
    }
    const granted = await usageStats.hasPermission();
    setStatus(granted ? 'granted' : 'denied');
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        check();
      }
    });
    return () => sub.remove();
  }, [check]);

  // Keep an append-only record of grant/revoke changes once the user has opted in.
  const choice = settings.monitoring.choice;
  useEffect(() => {
    if (status === 'granted' || status === 'denied') {
      observeRef.current(status === 'granted');
    }
  }, [status, choice]);

  return { status, recheck: check };
}
