import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  BreathingPause,
  Button,
  Card,
  FadeIn,
  Pip,
  ScreenContainer,
  Txt,
} from '../../components';
import type { RootTabParamList } from '../../navigation/types';
import { useSettings } from '../../state/SettingsContext';
import { PRIORITIES } from '../../state/settings';
import { colors, radius, STICKER_OFFSET } from '../../theme/tokens';
import { haptic } from '../../utils/haptics';
import { useUsageAccess } from '../usage/useUsageAccess';

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) {
    return 'Still up';
  }
  if (h < 12) {
    return 'Good morning';
  }
  if (h < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

function Tile({
  title,
  body,
  icon,
  tone,
  onPress,
  label,
}: {
  title: string;
  body: string;
  icon: string;
  tone: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.tileOuter, pressed && styles.pressed]}
    >
      <View style={styles.tileShadow} />
      <View style={[styles.tile, { backgroundColor: tone }]}>
        <Txt style={styles.tileIcon} importantForAccessibility="no">
          {icon}
        </Txt>
        <Txt variant="heading">{title}</Txt>
        <Txt variant="caption" color={colors.inkSoft}>
          {body}
        </Txt>
      </View>
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation =
    useNavigation<BottomTabNavigationProp<RootTabParamList, 'Home'>>();
  const { settings } = useSettings();
  const [pauseOpen, setPauseOpen] = useState(false);
  const { status } = useUsageAccess();
  const setupPending =
    settings.monitoring.choice === 'requested' &&
    !settings.monitoring.paused &&
    status !== 'unavailable' &&
    status !== 'checking' &&
    (status !== 'granted' || settings.trackedApps.length === 0);
  const name = settings.profile.name.trim();
  const wants = PRIORITIES.filter(p => settings.priorities.includes(p.id)).map(
    p => p.label.toLowerCase(),
  );

  return (
    <ScreenContainer>
      <FadeIn>
        <Txt variant="label">reclaim</Txt>
        <Txt variant="display">
          {greeting(new Date())}
          {name ? `, ${name}` : ''}.
        </Txt>
      </FadeIn>

      <FadeIn delay={100}>
        <Card tone="butter" style={styles.hero}>
          <Pip size={150} mood="happy" growth={0} />
          <Txt variant="title" center>
            Your sprout is still tiny
          </Txt>
          <Txt center>
            It grows with every minute you spend in focus. Ready for the first
            one?
          </Txt>
          <View style={styles.full}>
            <Button
              label="Start a focus session"
              onPress={() => navigation.navigate('Focus')}
            />
          </View>
        </Card>
      </FadeIn>

      {setupPending ? (
        <FadeIn delay={150}>
          <Card tone="orange">
            <Txt variant="label" color={colors.ink}>
              Almost there
            </Txt>
            <Txt variant="heading">Finish setting up app time</Txt>
            <Txt color={colors.ink}>
              {status !== 'granted'
                ? 'Allow Usage Access so I can show time in the apps you choose.'
                : 'Choose which apps you want to see.'}
            </Txt>
            <Button
              label="Continue setup"
              variant="secondary"
              onPress={() => navigation.navigate('Insights')}
            />
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn delay={200} style={styles.tiles}>
        <Tile
          title="Breathe"
          body="One slow minute"
          icon="🫧"
          tone={colors.skySoft}
          label="Take a one minute breathing pause"
          onPress={() => setPauseOpen(true)}
        />
        <Tile
          title="Think"
          body="A 3-minute puzzle"
          icon="🧩"
          tone={colors.leafSoft}
          label="Open a critical thinking exercise"
          onPress={() => navigation.navigate('Train')}
        />
      </FadeIn>

      {wants.length ? (
        <FadeIn delay={300}>
          <Card>
            <Txt variant="label">Why you're here</Txt>
            <Txt variant="bodyBold">
              More time for {wants.slice(0, 3).join(', ')}.
            </Txt>
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn delay={380}>
        <Card tone="sand" flat>
          <Txt variant="bodyBold">
            You don't have to fill every quiet moment.
          </Txt>
          <Txt variant="caption">A pause can be a choice, too.</Txt>
        </Card>
      </FadeIn>

      <BreathingPause visible={pauseOpen} onClose={() => setPauseOpen(false)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  full: { alignSelf: 'stretch', marginTop: 8 },
  tiles: { flexDirection: 'row', gap: 12 },
  tileOuter: {
    flex: 1,
    paddingRight: STICKER_OFFSET,
    paddingBottom: STICKER_OFFSET,
  },
  tileShadow: {
    position: 'absolute',
    top: STICKER_OFFSET,
    left: STICKER_OFFSET,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  tile: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.line,
    padding: 16,
    gap: 4,
    minHeight: 130,
  },
  tileIcon: { fontSize: 30, lineHeight: 38, marginBottom: 4 },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
});
