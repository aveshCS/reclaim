import { sanitizeSettings } from '../services/settingsStorage';
import type { AppSettings } from '../state/settings';

/**
 * The part of the settings that is backed up. Only personal preferences and progress.
 * Never backed up: the apps you track or pause, your website list, the reels counter,
 * the pause level, Android permission state and onboarding progress. Those describe this
 * phone, and the app promises they stay on it.
 */
export const BACKED_UP_KEYS = [
  'profile',
  'priorities',
  'focusMinutes',
  'plan',
  'sound',
  'reset',
  'practice',
] as const;

export type BackupSettings = Pick<AppSettings, (typeof BACKED_UP_KEYS)[number]>;

export function pickBackup(s: AppSettings): BackupSettings {
  const out: Partial<BackupSettings> = {};
  for (const k of BACKED_UP_KEYS) {
    (out as Record<string, unknown>)[k] = s[k];
  }
  return out as BackupSettings;
}

/** Puts backed-up preferences onto this phone's settings. Anything malformed falls back safely. */
export function applyBackup(
  current: AppSettings,
  data: Record<string, unknown>,
): AppSettings {
  const merged: Record<string, unknown> = { ...current };
  for (const k of BACKED_UP_KEYS) {
    if (k in data) {
      merged[k] = data[k];
    }
  }
  return sanitizeSettings(merged);
}
