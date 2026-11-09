import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, Tile, Txt } from '../../components';
import { pauseGate, PauseDayStats, planLine } from '../../native/pauseGate';
import { useSettings } from '../../state/SettingsContext';
import { colors, radius } from '../../theme/tokens';
import { localDateKey, startOfLocalDayDaysAgo } from '../../utils/time';
import { AppPicker } from '../usage/AppPicker';
import { DisclosureRows } from './DisclosureRows';
import { KeepRunning } from './KeepRunning';

/** Keeps the native pause configuration in step with settings. Render once near the root. */
export function PauseGateSync() {
  const { settings } = useSettings();
  const { gate, plan, web, reels, intensity } = settings;
  const key = JSON.stringify([gate, plan]);
  const extrasKey = JSON.stringify([web, reels]);
  useEffect(() => {
    pauseGate.configure(
      gate.enabled,
      gate.packages,
      gate.allowMinutes,
      plan ? `${plan.when} → ${plan.then}` : '',
    );
    // key captures every relevant field
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const intensityKey = JSON.stringify(intensity);
  useEffect(() => {
    pauseGate.configureIntensity(intensity);
    // intensityKey captures every field
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensityKey]);
  useEffect(() => {
    pauseGate.configureExtras(
      web.enabled,
      web.sites,
      reels.enabled,
      reels.limit,
      reels.showPip,
    );
    // extrasKey captures every relevant field
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extrasKey]);
  return null;
}

/** Re-checks whether the Android service is on, including after returning from Settings. */
export function usePauseService() {
  const [on, setOn] = useState<boolean | null>(null);
  const [stopped, setStopped] = useState(false);
  const [maker, setMaker] = useState('');
  const check = useCallback(async () => {
    if (pauseGate.getServiceState) {
      const st = await pauseGate.getServiceState();
      // "On" means running. Switched on but not running = the phone stopped it.
      setOn(st.enabled && st.running);
      setStopped(st.enabled && !st.running);
      setMaker(st.maker);
    } else {
      setOn(await pauseGate.isServiceEnabled());
    }
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
  return { on, check, stopped, maker };
}

const APP_ROWS = [
  { icon: '🫧', text: 'A breath before the apps you chose.' },
  { icon: '👀', text: 'Sees only which app opens.' },
  { icon: '🚫', text: 'Never reads your screen, messages or typing.' },
  { icon: '📱', text: 'Stays on this phone. Nothing is sent.' },
  { icon: '🔓', text: 'Switch it off any time.' },
];

/** What the app pause accesses. Shown in its own disclosure and in onboarding. */
export function AppPauseDisclosureBody() {
  return (
    <DisclosureRows rows={APP_ROWS}>
        <Card>
          <Txt variant="bodyBold">Why</Txt>
          <Txt>
            To show a short breathing pause when you open one of the apps you
            chose, so you can decide on purpose.
          </Txt>
          <Txt variant="bodyBold">What it accesses</Txt>
          <Txt>
            Only the name of the app that comes to the front (for example
            "com.instagram.android"). It is compared with your list on this
            phone.
          </Txt>
          <Txt variant="bodyBold">What it never does</Txt>
          <Txt>
            For the app pause it does not read what is on your screen, your
            messages, what you type or your browsing. It does not tap, scroll or
            change anything in other apps, and nothing is sent anywhere.
          </Txt>
          <Txt variant="bodyBold">Why Android may say "view and control screen"</Txt>
          <Txt>
            The same service also powers two optional features, the website
            pause and the reels counter, which need to see a little of the
            screen. They stay off unless you switch each one on separately,
            after its own explanation.
          </Txt>
          <Txt variant="bodyBold">What is stored</Txt>
          <Txt>
            Your list of apps and daily counts of pauses, "Not now" and "Open
            anyway", only on this phone.
          </Txt>
          <Txt variant="bodyBold">Your control</Txt>
          <Txt>
            "Open anyway" always works. Turn the pause off in RECLAIM or in
            Android Settings › Accessibility at any time.
          </Txt>
        </Card>
    </DisclosureRows>
  );
}

export const APP_PAUSE_AGREE =
  'I understand and agree to RECLAIM using the Accessibility service for this';

/**
 * Google Play requires a separate, prominent in-app disclosure with affirmative consent
 * before an app that is not an accessibility tool asks the user to enable its
 * AccessibilityService. This is that screen. It is not bundled with any other consent.
 */
export function PauseDisclosure({
  visible,
  onAgree,
  onDecline,
}: {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [ticked, setTicked] = useState(false);
  useEffect(() => {
    if (visible) {
      setTicked(false);
    }
  }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDecline}>
      <ScrollView
        style={styles.modalRoot}
        contentContainerStyle={[
          styles.modal,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Txt variant="label">Before you switch this on</Txt>
        <Txt variant="title">RECLAIM uses Android's Accessibility service</Txt>
        <AppPauseDisclosureBody />
        <Chip
          block
          label={APP_PAUSE_AGREE}
          selected={ticked}
          onPress={() => setTicked(t => !t)}
        />
        <Button
          label="Agree and open settings"
          disabled={!ticked}
          onPress={onAgree}
        />
        <Button label="No thanks" variant="ghost" onPress={onDecline} />
      </ScrollView>
    </Modal>
  );
}

function last7(): string[] {
  const now = Date.now();
  return [6, 5, 4, 3, 2, 1, 0].map(d =>
    localDateKey(startOfLocalDayDaysAgo(now, d)),
  );
}

export function PauseSetup() {
  const s = useSettings();
  const { gate, plan } = s.settings;
  const { on, check, stopped, maker } = usePauseService();
  const [disclose, setDisclose] = useState(false);
  const [picker, setPicker] = useState(false);
  const [stats, setStats] = useState<PauseDayStats[]>([]);

  useEffect(() => {
    if (!gate.enabled || !on) {
      return;
    }
    const load = () => pauseGate.getStats(last7()).then(setStats);
    load();
    // Pauses happen while RECLAIM is in the background; refresh when we come back.
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        load();
      }
    });
    return () => sub.remove();
  }, [gate.enabled, on]);

  if (!pauseGate.isAvailable()) {
    return null;
  }

  const week = stats.reduce(
    (a, d) => ({
      shown: a.shown + d.shown,
      notNow: a.notNow + d.notNow,
    }),
    { shown: 0, notNow: 0 },
  );

  const pickerEl = (
    <AppPicker
      visible={picker}
      initial={gate.packages}
      onCancel={() => setPicker(false)}
      onSave={apps => {
        s.setGateApps(apps);
        setPicker(false);
      }}
    />
  );

  const apps = gate.packages.length;
  const summary = !gate.enabled
    ? 'Off'
    : stopped
    ? 'Stopped by your phone'
    : on === false
    ? 'One step left'
    : apps === 0
    ? 'Choose your apps'
    : week.shown
    ? `${week.shown} pauses · ${week.notNow} × Not now`
    : `On · ${apps} ${apps === 1 ? 'app' : 'apps'}`;

  return (
    <Tile
      icon="🫧"
      label="App pause"
      summary={summary}
      tone="sky"
      defaultOpen={!gate.enabled || apps === 0}
    >
      {!gate.enabled ? (
        <>
          <Txt>A 5-second breath before the apps you choose.</Txt>
          <Txt variant="caption">In a 6-week study: about 37% fewer opens.</Txt>
          <Button label="Set up the pause" onPress={() => setDisclose(true)} />
        </>
      ) : (
        <>
          <Txt variant="bodyBold">
            {apps ? gate.packages.map(a => a.label).join(', ') : 'No apps yet'}
          </Txt>
          <Button
            label={apps ? 'Edit apps' : 'Choose apps'}
            variant="secondary"
            onPress={() => setPicker(true)}
          />
          <Txt variant="bodyBold">"Open anyway" lasts</Txt>
          <View style={styles.chips}>
            {[2, 5, 10, 15].map(m => (
              <Chip
                key={m}
                role="radio"
                label={`${m} min`}
                selected={gate.allowMinutes === m}
                onPress={() => s.setGateMinutes(m)}
              />
            ))}
          </View>
          {on === false ? (
            <KeepRunning stopped={stopped} maker={maker} onDone={check} />
          ) : on ? (
            <Txt variant="bodyBold" color={colors.leaf}>
              ✓ The pause is on.
            </Txt>
          ) : null}
          {plan ? (
            <Txt variant="caption">On the pause: “{planLine(plan)}”</Txt>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Turn the pause off"
            onPress={() => s.setGate(false)}
            hitSlop={8}
          >
            <Txt variant="caption" style={styles.link}>
              Turn the pause off
            </Txt>
          </Pressable>
        </>
      )}

      <PauseDisclosure
        visible={disclose}
        onDecline={() => setDisclose(false)}
        onAgree={() => {
          setDisclose(false);
          s.setGate(true);
          if (gate.packages.length === 0 && s.settings.trackedApps.length) {
            s.setGateApps(s.settings.trackedApps);
          }
          pauseGate.openSettings().catch(() => {});
        }}
      />
      {pickerEl}
    </Tile>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  warn: {
    gap: 8,
    backgroundColor: colors.butterSoft,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    padding: 12,
  },
  link: { textDecorationLine: 'underline', color: colors.inkSoft },
  modalRoot: { flex: 1, backgroundColor: colors.paper },
  modal: { paddingHorizontal: 24, gap: 12 },
});
