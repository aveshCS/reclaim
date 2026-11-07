import { NativeModules, Platform } from 'react-native';
import type { TrackedApp } from '../state/settings';

export type PauseDayStats = {
  date: string;
  shown: number;
  notNow: number;
  opened: number;
};

type NativeGate = {
  isServiceEnabled(): Promise<boolean>;
  openAccessibilitySettings(): Promise<boolean>;
  configure(
    enabled: boolean,
    packages: TrackedApp[],
    allowMinutes: number,
    plan: string,
  ): Promise<boolean>;
  getStats(dates: string[]): Promise<PauseDayStats[]>;
  clearStats(): Promise<boolean>;
};

function native(): NativeGate | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  return (NativeModules.ReclaimPauseGate as NativeGate | undefined) ?? null;
}

/** Thin, safe wrapper: every call degrades gracefully when the native side is missing. */
export const pauseGate = {
  isAvailable: () => native() !== null,
  async isServiceEnabled(): Promise<boolean> {
    try {
      return (await native()?.isServiceEnabled()) ?? false;
    } catch {
      return false;
    }
  },
  async openSettings(): Promise<void> {
    const n = native();
    if (!n) {
      throw new Error('The pause works only in the Android app.');
    }
    await n.openAccessibilitySettings();
  },
  async configure(
    enabled: boolean,
    packages: TrackedApp[],
    allowMinutes: number,
    plan: string,
  ): Promise<void> {
    try {
      await native()?.configure(enabled, packages, allowMinutes, plan);
    } catch {
      // Configuration is retried on the next change.
    }
  },
  async getStats(dates: string[]): Promise<PauseDayStats[]> {
    try {
      return (await native()?.getStats(dates)) ?? [];
    } catch {
      return [];
    }
  },
  async clearStats(): Promise<void> {
    try {
      await native()?.clearStats();
    } catch {
      // ignore
    }
  },
};

export function planLine(plan: { when: string; then: string } | null): string {
  return plan ? `When ${plan.when}, I will ${plan.then}.` : '';
}
