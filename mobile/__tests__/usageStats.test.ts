import { NativeModules, Platform } from 'react-native';
import { UsageError, usageStats } from '../src/native/usageStats';

const DAY = 24 * 60 * 60 * 1000;
const native = {
  hasUsageAccess: jest.fn(),
  openUsageAccessSettings: jest.fn(),
  getLaunchableApps: jest.fn(),
  getUsageSummary: jest.fn(),
};

describe('usageStats bridge wrapper', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
    NativeModules.ReclaimUsageStats = native;
    Object.values(native).forEach(f => f.mockReset());
  });
  afterEach(() => {
    delete NativeModules.ReclaimUsageStats;
    jest.restoreAllMocks();
  });

  it('reports unavailable and never throws for permission checks without the native module', async () => {
    delete NativeModules.ReclaimUsageStats;
    expect(usageStats.isAvailable()).toBe(false);
    await expect(usageStats.hasPermission()).resolves.toBe(false);
    await expect(usageStats.getLaunchableApps()).rejects.toMatchObject({
      code: 'NOT_AVAILABLE',
    });
  });

  it('is unavailable on non-Android platforms', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    expect(usageStats.isAvailable()).toBe(false);
  });

  it('treats a failing permission check as "not granted"', async () => {
    native.hasUsageAccess.mockRejectedValue(new Error('boom'));
    await expect(usageStats.hasPermission()).resolves.toBe(false);
  });

  it('rejects invalid and too-long ranges before calling native code', async () => {
    await expect(usageStats.getSummary(10, 5, ['a'])).rejects.toMatchObject({
      code: 'INVALID_RANGE',
    });
    await expect(
      usageStats.getSummary(0, 40 * DAY, ['a']),
    ).rejects.toMatchObject({ code: 'RANGE_TOO_LONG' });
    expect(native.getUsageSummary).not.toHaveBeenCalled();
  });

  it('does not call native code for an empty app list', async () => {
    const s = await usageStats.getSummary(1, 2, []);
    expect(s.apps).toEqual([]);
    expect(native.getUsageSummary).not.toHaveBeenCalled();
  });

  it('de-duplicates requested packages and drops anything not requested', async () => {
    native.getUsageSummary.mockResolvedValue({
      rangeStartMs: 1,
      rangeEndMs: 2,
      source: 'android_usage_events',
      eventCount: 3,
      apps: [
        { packageName: 'com.a', foregroundMs: 5, openCount: 1 },
        { packageName: 'com.secret', foregroundMs: 9, openCount: 9 },
      ],
    });
    const s = await usageStats.getSummary(1, 2, ['com.a', 'com.a', '']);
    expect(native.getUsageSummary).toHaveBeenCalledWith(1, 2, ['com.a']);
    expect(s.apps.map(a => a.packageName)).toEqual(['com.a']);
  });

  it('maps native error codes, including permission denied', async () => {
    native.getUsageSummary.mockRejectedValue(
      Object.assign(new Error('no access'), {
        code: 'USAGE_ACCESS_NOT_GRANTED',
      }),
    );
    const err = await usageStats.getSummary(1, 2, ['com.a']).catch(e => e);
    expect(err).toBeInstanceOf(UsageError);
    expect(err.code).toBe('USAGE_ACCESS_NOT_GRANTED');

    native.getUsageSummary.mockRejectedValue(new Error('weird'));
    await expect(usageStats.getSummary(1, 2, ['com.a'])).rejects.toMatchObject({
      code: 'FAILED',
    });
  });
});
