import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  ErrorState,
  LoadingState,
  Pip,
  Txt,
} from '../../components';
import { usageStats } from '../../native/usageStats';
import { useSettings } from '../../state/SettingsContext';
import { CONSENT_PURPOSE_USAGE_ACCESS } from '../../state/settings';
import { colors } from '../../theme/tokens';
import { formatClock, formatDuration } from '../../utils/time';
import { AppPicker } from './AppPicker';
import { useAppUsage } from './useAppUsage';
import { useUsageAccess } from './useUsageAccess';

/**
 * The whole "app time" journey in one place, with an honest state for each case:
 * off, paused, not available, needs permission, needs apps, loading, error, data.
 */
export function AppTimeSection() {
  const s = useSettings();
  const { settings } = s;
  const { status } = useUsageAccess();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const optedIn = settings.monitoring.choice === 'requested';
  const paused = settings.monitoring.paused;
  const apps = settings.trackedApps;
  const canRead = optedIn && !paused && status === 'granted';
  const { state, refresh } = useAppUsage(apps, canRead);

  const picker = (
    <AppPicker
      visible={pickerOpen}
      initial={apps}
      onCancel={() => setPickerOpen(false)}
      onSave={picked => {
        s.setTrackedApps(picked);
        setPickerOpen(false);
      }}
    />
  );

  if (!optedIn) {
    return (
      <Card>
        <Txt variant="label">App time</Txt>
        <Txt variant="heading">See where your time goes (optional)</Txt>
        <Txt>⏱ Time in apps you pick. Never your messages or screen.</Txt>
        <Button
          label="Set up app time"
          variant="secondary"
          onPress={() => s.setMonitoringChoice('requested')}
        />
      </Card>
    );
  }

  if (paused) {
    return (
      <Card tone="sand">
        <Txt variant="label">App time</Txt>
        <Txt variant="heading">Paused</Txt>
        <Txt>Nothing is being read while app time is paused.</Txt>
        <Button
          label="Resume"
          variant="secondary"
          onPress={() => s.setMonitoringPaused(false)}
        />
      </Card>
    );
  }

  if (status === 'unavailable') {
    return (
      <Card tone="sand">
        <Txt variant="label">App time</Txt>
        <Txt>App time works only in the Android app.</Txt>
      </Card>
    );
  }

  if (status === 'checking') {
    return <LoadingState label="Checking Usage Access" />;
  }

  if (status === 'denied') {
    return (
      <Card tone="butter" style={styles.gap}>
        <View style={styles.row}>
          <Pip size={72} mood="think" bob={false} />
          <View style={styles.flex}>
            <Txt variant="label">One step left</Txt>
            <Txt variant="heading">Allow Usage Access</Txt>
          </View>
        </View>
        <Txt>
          Android will open its Usage access list. Find RECLAIM, switch on
          "Permit usage access", then come back here.
        </Txt>
        <Txt variant="caption">
          This lets RECLAIM see how long apps were open. It cannot see what you
          did inside them. You can switch it off there any time.
        </Txt>
        <Button
          label="Open Android settings"
          onPress={() => {
            setOpenError(null);
            usageStats
              .openSettings()
              .catch(e =>
                setOpenError(
                  e instanceof Error ? e.message : 'Could not open settings.',
                ),
              );
          }}
        />
        {openError ? <Txt color={colors.danger}>{openError}</Txt> : null}
        {settings.consents.some(
          c => c.purpose === CONSENT_PURPOSE_USAGE_ACCESS && c.granted,
        ) ? (
          <Txt variant="caption">
            Usage Access was switched off. Your app list is kept, and nothing is
            read until you allow it again.
          </Txt>
        ) : null}
      </Card>
    );
  }

  if (apps.length === 0) {
    return (
      <>
        <Card tone="leaf">
          <Txt variant="label" color={colors.leaf}>
            Access granted
          </Txt>
          <Txt variant="heading">Now choose your apps</Txt>
          <Txt>
            Pick the apps you'd like to spend less time in. RECLAIM only looks
            at those.
          </Txt>
          <Button label="Choose apps" onPress={() => setPickerOpen(true)} />
        </Card>
        {picker}
      </>
    );
  }

  return (
    <>
      <Card>
        <View style={styles.headerRow}>
          <Txt variant="label">App time today</Txt>
          {state.kind === 'ready' ? (
            <Txt variant="caption">Updated {formatClock(state.updatedAt)}</Txt>
          ) : null}
        </View>

        {state.kind === 'loading' || state.kind === 'idle' ? (
          <LoadingState label="Reading app time" />
        ) : null}

        {state.kind === 'error' ? (
          <ErrorState message={state.message} onRetry={refresh} />
        ) : null}

        {state.kind === 'ready' ? (
          <>
            <Txt
              variant="display"
              accessibilityLabel={`Total today ${formatDuration(
                state.todayTotalMs,
              )}`}
            >
              {formatDuration(state.todayTotalMs)}
            </Txt>
            <Txt variant="caption">
              across {apps.length} app{apps.length === 1 ? '' : 's'} you chose
            </Txt>
            <View style={styles.rows}>
              {state.rows.map(r => (
                <View
                  key={r.packageName}
                  style={styles.appRow}
                  accessible
                  accessibilityLabel={`${r.label}: ${formatDuration(
                    r.todayMs,
                  )} today, opened ${r.todayOpens} times, ${formatDuration(
                    r.weekMs,
                  )} in the last 7 days`}
                >
                  <View style={styles.flex}>
                    <Txt variant="bodyBold">{r.label}</Txt>
                    <Txt variant="caption">
                      Opened {r.todayOpens}× today · {formatDuration(r.weekMs)}{' '}
                      in 7 days
                    </Txt>
                  </View>
                  <Txt variant="heading">{formatDuration(r.todayMs)}</Txt>
                </View>
              ))}
            </View>
            {state.weekPartial ? (
              <Txt variant="caption">
                Android only had part of the last 7 days, so weekly numbers may
                be low.
              </Txt>
            ) : null}
          </>
        ) : null}

        <Txt variant="caption">
          Estimates from Android, read when you open this screen. They show
          time, not what you did or how you felt.
        </Txt>
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label="Refresh" variant="secondary" onPress={refresh} />
          </View>
          <View style={styles.flex}>
            <Button
              label="Edit apps"
              variant="secondary"
              onPress={() => setPickerOpen(true)}
            />
          </View>
        </View>
      </Card>
      {picker}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rows: { gap: 4, marginTop: 4 },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  actions: { flexDirection: 'row', gap: 10 },
});
