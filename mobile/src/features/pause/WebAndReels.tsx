import React, { useEffect, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, CountUp, Pip, Txt } from '../../components';
import type { PipMood } from '../../components/Pip';
import { pauseGate, REEL_APPS, ReelDayStats } from '../../native/pauseGate';
import { useSettings } from '../../state/SettingsContext';
import { normalizeSite, REEL_LIMITS } from '../../state/settings';
import { colors, fonts, radius } from '../../theme/tokens';
import { localDateKey, startOfLocalDayDaysAgo, weekdayShort } from '../../utils/time';
import { usePauseService } from './PauseSetup';

export const SUGGESTED_SITES = [
  'youtube.com',
  'instagram.com',
  'facebook.com',
  'x.com',
  'reddit.com',
  'tiktok.com',
];

type Kind = 'web' | 'reels';

const DISCLOSURE: Record<
  Kind,
  { title: string; why: string; reads: string; never: string; stored: string; agree: string }
> = {
  web: {
    title: 'The website pause reads your browser\'s address bar',
    why: 'To show the same breathing pause when you open a website you chose, like reddit.com, in your browser.',
    reads:
      'Only the text of the address bar in common browsers (Chrome, Brave, Edge, Firefox, Samsung Internet, Opera, DuckDuckGo). RECLAIM shortens it to the site name and compares it with your list on this phone.',
    never:
      'It does not read page content, what you type, passwords or your history. It ignores the address bar while you are typing in it. It never taps or changes anything in the browser.',
    stored:
      'Your list of sites and daily counts of pauses, only on this phone. The addresses you visit are not stored or sent anywhere.',
    agree: 'I understand and agree to RECLAIM reading my browser\'s address bar for this',
  },
  reels: {
    title: 'The reels counter notices short-video swipes',
    why: 'To count how many Reels and Shorts you scroll through each day, show Pip with the count on top of them (you can switch Pip off), and, if you want, pause you at a daily limit.',
    reads:
      'Only that the short-video player in YouTube or Instagram moved to the next video. RECLAIM recognises the player by its name and position in the app\'s layout.',
    never:
      'It does not read which videos you watch, captions, comments, messages or anything else on screen. It never taps or scrolls for you.',
    stored:
      'One number per app per day, only on this phone. Nothing is sent anywhere.',
    agree: 'I understand and agree to RECLAIM noticing short-video swipes for this',
  },
};

/** Its own prominent disclosure, as Google Play requires for each kind of on-screen data. */
export function FeatureDisclosure({
  kind,
  visible,
  onAgree,
  onDecline,
}: {
  kind: Kind;
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
  const d = DISCLOSURE[kind];
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
        <Txt variant="title">{d.title}</Txt>
        <Card>
          <Txt variant="bodyBold">Why</Txt>
          <Txt>{d.why}</Txt>
          <Txt variant="bodyBold">What it reads</Txt>
          <Txt>{d.reads}</Txt>
          <Txt variant="bodyBold">What it never does</Txt>
          <Txt>{d.never}</Txt>
          <Txt variant="bodyBold">What is stored</Txt>
          <Txt>{d.stored}</Txt>
          <Txt variant="bodyBold">How it works</Txt>
          <Txt>
            It uses RECLAIM's Accessibility service (the same one as the app
            pause). If that service is off, you'll be taken to Android Settings
            to switch it on.
          </Txt>
          <Txt variant="bodyBold">Your control</Txt>
          <Txt>
            Switch it off here at any time. To remove the permission completely,
            turn RECLAIM off in Android Settings › Accessibility.
          </Txt>
        </Card>
        <Chip block label={d.agree} selected={ticked} onPress={() => setTicked(t => !t)} />
        <Button label="Agree and switch on" disabled={!ticked} onPress={onAgree} />
        <Button label="No thanks" variant="ghost" onPress={onDecline} />
      </ScrollView>
    </Modal>
  );
}

function OffLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}>
      <Txt variant="caption" style={styles.link}>
        {label}
      </Txt>
    </Pressable>
  );
}

function ServiceOff({ onOpen }: { onOpen: () => void }) {
  return (
    <View style={styles.warn}>
      <Txt variant="bodyBold">One step left</Txt>
      <Txt>
        In Android Settings › Accessibility, open "RECLAIM mindful pause" and
        switch it on, then come back.
      </Txt>
      <Button label="Open Accessibility settings" onPress={onOpen} />
    </View>
  );
}

// ---------------------------------------------------------------- Website pause

export function WebsitePause() {
  const s = useSettings();
  const { web } = s.settings;
  const { on, check } = usePauseService();
  const [disclose, setDisclose] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!pauseGate.isAvailable()) {
    return null;
  }

  const toggleSite = (site: string) =>
    s.setSites(
      web.sites.includes(site) ? web.sites.filter(x => x !== site) : [...web.sites, site],
    );

  const add = () => {
    const site = normalizeSite(draft);
    if (!site) {
      setError('Type a site like reddit.com');
      return;
    }
    setError(null);
    setDraft('');
    if (!web.sites.includes(site)) {
      s.setSites([...web.sites, site]);
    }
  };

  const custom = web.sites.filter(x => !SUGGESTED_SITES.includes(x));

  return (
    <Card tone="butter">
      <Txt variant="label" color={colors.ink}>
        Website pause
      </Txt>
      <Txt variant="heading">The same breath, in your browser</Txt>
      <Txt color={colors.ink}>
        Endless feeds also live in the browser. Choose sites, and RECLAIM shows
        the breathing pause when you open one.
      </Txt>
      {!web.enabled ? (
        <Button label="Set up the website pause" onPress={() => setDisclose(true)} />
      ) : (
        <>
          <Txt variant="bodyBold">Pause before these sites (choose any)</Txt>
          <View style={styles.chips}>
            {[...SUGGESTED_SITES, ...custom].map(site => (
              <Chip
                key={site}
                role="checkbox"
                label={site}
                selected={web.sites.includes(site)}
                onPress={() => toggleSite(site)}
              />
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput
              value={draft}
              onChangeText={t => {
                setDraft(t);
                setError(null);
              }}
              onSubmitEditing={add}
              placeholder="Add a site, e.g. 9gag.com"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel="Add a website"
              style={styles.input}
            />
            <Button label="Add" variant="secondary" onPress={add} />
          </View>
          {error ? <Txt color={colors.danger}>{error}</Txt> : null}
          {on === false ? (
            <ServiceOff onOpen={() => pauseGate.openSettings().then(check)} />
          ) : on ? (
            <Txt variant="bodyBold" color={colors.leaf}>
              ✓ On for {web.sites.length} {web.sites.length === 1 ? 'site' : 'sites'}.
            </Txt>
          ) : null}
          <Txt variant="caption">
            Works in Chrome, Brave, Edge, Firefox, Samsung Internet, Opera and
            DuckDuckGo. Other browsers aren't recognised yet.
          </Txt>
          <OffLink label="Turn the website pause off" onPress={() => s.setWeb(false)} />
        </>
      )}
      <FeatureDisclosure
        kind="web"
        visible={disclose}
        onDecline={() => setDisclose(false)}
        onAgree={() => {
          setDisclose(false);
          s.setWeb(true);
          if (web.sites.length === 0) {
            s.setSites(SUGGESTED_SITES.slice(0, 3));
          }
          if (on === false) {
            pauseGate.openSettings().catch(() => {});
          }
        }}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- Reels counter

function lastDays(n: number): string[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) =>
    localDateKey(startOfLocalDayDaysAgo(now, n - 1 - i)),
  );
}

/** Daily reel counts for the last 7 days, refreshed when RECLAIM comes back to the front. */
export function useReelStats(enabled: boolean) {
  const [days, setDays] = useState<ReelDayStats[]>([]);
  useEffect(() => {
    if (!enabled) {
      setDays([]);
      return;
    }
    const load = () => pauseGate.getReelStats(lastDays(7)).then(setDays);
    load();
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        load();
      }
    });
    return () => sub.remove();
  }, [enabled]);
  const today = days.length ? days[days.length - 1] : null;
  return { days, today };
}

/** Pip reacts to today's count without scolding. Never wilts or shrinks. */
export function reelMood(count: number, limit: number): { mood: PipMood; line: string } {
  if (count === 0) {
    return { mood: 'cheer', line: 'No reels yet today. Your attention is all yours.' };
  }
  if (limit > 0 && count >= limit) {
    return {
      mood: 'concerned',
      line: `You've reached your limit of ${limit}. Want to do something with your hands for a bit?`,
    };
  }
  if (count < 20) {
    return { mood: 'happy', line: 'A few reels. Totally fine. Notice how you feel after.' };
  }
  if (count < 60) {
    return { mood: 'think', line: 'That\'s a good number of reels. Is it still fun?' };
  }
  return {
    mood: 'concerned',
    line: 'That\'s a lot of quick switches for your attention today. A slow walk might feel good.',
  };
}

export function ReelsCounter() {
  const s = useSettings();
  const { reels } = s.settings;
  const { on, check } = usePauseService();
  const [disclose, setDisclose] = useState(false);
  const { days, today } = useReelStats(reels.enabled && on === true);

  if (!pauseGate.isAvailable()) {
    return null;
  }

  const count = today?.total ?? 0;
  const { mood, line } = reelMood(count, reels.limit);
  const max = Math.max(1, reels.limit, ...days.map(d => d.total));
  const week = days.reduce((a, d) => a + d.total, 0);

  return (
    <Card tone="orange">
      <Txt variant="label" color={colors.ink}>
        Reels counter
      </Txt>
      <Txt variant="heading">How many did you scroll?</Txt>
      {!reels.enabled ? (
        <>
          <Txt color={colors.ink}>
            Counts YouTube Shorts and Instagram Reels as you swipe, so you see
            the real number. Add a daily limit if you like, and RECLAIM pauses
            you when you reach it.
          </Txt>
          <Button label="Count my reels" onPress={() => setDisclose(true)} />
        </>
      ) : (
        <>
          {on === false ? (
            <ServiceOff onOpen={() => pauseGate.openSettings().then(check)} />
          ) : (
            <>
              <View style={styles.row}>
                <Pip size={76} mood={mood} bob={false} />
                <View style={styles.flex}>
                  <CountUp value={count} variant="display" />
                  <Txt variant="bodyBold">
                    {count === 1 ? 'reel today' : 'reels today'}
                    {reels.limit ? ` · limit ${reels.limit}` : ''}
                  </Txt>
                </View>
              </View>
              <Txt>{line}</Txt>
              {today && count > 0 ? (
                <Txt variant="caption">
                  {REEL_APPS.filter(a => today.byApp[a.packageName])
                    .map(a => `${a.label}: ${today.byApp[a.packageName]}`)
                    .join(' · ')}
                </Txt>
              ) : null}
              {days.length ? (
                <View
                  style={styles.bars}
                  accessible
                  accessibilityLabel={`Reels in the last 7 days: ${days
                    .map(d => d.total)
                    .join(', ')}`}
                >
                  {days.map(d => (
                    <View key={d.date} style={styles.barCol}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            { height: `${Math.round((d.total / max) * 100)}%` },
                          ]}
                        />
                      </View>
                      <Txt variant="caption">{weekdayShort(d.date)}</Txt>
                    </View>
                  ))}
                </View>
              ) : null}
              {week ? <Txt variant="caption">This week: {week} reels.</Txt> : null}
            </>
          )}
          <Txt variant="bodyBold">Daily limit (choose one)</Txt>
          <View style={styles.chips}>
            {REEL_LIMITS.map(l => (
              <Chip
                key={l}
                role="radio"
                label={l === 0 ? 'Just count' : `${l}`}
                selected={reels.limit === l}
                onPress={() => s.setReelLimit(l)}
              />
            ))}
          </View>
          <Chip
            block
            role="checkbox"
            label="Show Pip with the count on top of Shorts and Reels"
            selected={reels.showPip}
            onPress={() => s.setReelPip(!reels.showPip)}
          />
          <Txt variant="caption">
            Counts each new reel you swipe to. Facebook and Snapchat can't be
            counted yet. The count may miss reels if an app changes its layout.
          </Txt>
          <OffLink label="Turn the reels counter off" onPress={() => s.setReels(false)} />
        </>
      )}
      <FeatureDisclosure
        kind="reels"
        visible={disclose}
        onDecline={() => setDisclose(false)}
        onAgree={() => {
          setDisclose(false);
          s.setReels(true);
          if (on === false) {
            pauseGate.openSettings().catch(() => {});
          }
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  warn: {
    gap: 8,
    backgroundColor: colors.butterSoft,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    padding: 12,
  },
  bars: { flexDirection: 'row', gap: 6, height: 110, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: {
    width: '100%',
    height: 84,
    justifyContent: 'flex-end',
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  bar: { width: '100%', backgroundColor: colors.ink },
  link: { textDecorationLine: 'underline', color: colors.inkSoft },
  modalRoot: { flex: 1, backgroundColor: colors.paper },
  modal: { paddingHorizontal: 24, gap: 12 },
});
