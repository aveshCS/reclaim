import React, { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import {
  Card,
  Chip,
  ErrorState,
  Pip,
  ScreenContainer,
  SectionHeading,
  Txt,
} from '../../components';
import { useSettings } from '../../state/SettingsContext';
import {
  EXAMS,
  isMonitoringActive,
  PRIORITIES,
  ROLES,
} from '../../state/settings';
import { colors, fonts, MIN_TOUCH_TARGET, radius } from '../../theme/tokens';
import { FocusDurationPicker } from '../settings/FocusDurationPicker';

export function ProfileScreen() {
  const s = useSettings();
  const { settings } = s;
  const { profile } = settings;
  const choice = settings.monitoring.choice;
  const lastConsent = settings.consents[settings.consents.length - 1];
  const studies = profile.role === 'student' || profile.role === 'both';
  // Local draft so typing stays smooth; saved when editing ends.
  const [nameDraft, setNameDraft] = useState(profile.name);

  let monitoringStatus = 'Off. Nothing is collected.';
  if (choice === 'requested') {
    monitoringStatus = settings.monitoring.paused
      ? 'Paused. Nothing is collected.'
      : `On. ${settings.trackedApps.length} app${
          settings.trackedApps.length === 1 ? '' : 's'
        } chosen. See and edit them in Insights.`;
  }

  return (
    <ScreenContainer>
      <SectionHeading kicker="Your reclaim" title="Your settings." />
      {s.saveFailed ? (
        <ErrorState message="Your latest changes could not be saved on this phone." />
      ) : null}

      <Card tone="butter" style={styles.aboutRow}>
        <Pip size={80} mood="happy" bob={false} />
        <View style={styles.flex}>
          <Txt variant="heading">
            {profile.name.trim() ? profile.name.trim() : 'Hello there'}
          </Txt>
          <Txt variant="caption" color={colors.inkSoft}>
            Everything here stays on this phone.
          </Txt>
        </View>
      </Card>

      <Card>
        <Txt variant="heading">About you</Txt>
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          onEndEditing={() => s.setName(nameDraft.trim())}
          placeholder="Your first name"
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel="Your first name"
          style={styles.input}
        />
        <View style={styles.chips}>
          {ROLES.map(r => (
            <Chip
              key={r.id}
              role="radio"
              label={r.label}
              selected={profile.role === r.id}
              onPress={() => s.setRole(r.id)}
            />
          ))}
        </View>
        {studies ? (
          <>
            <Txt variant="bodyBold">Preparing for</Txt>
            <View style={styles.chips}>
              {EXAMS.map(e => (
                <Chip
                  key={e.id}
                  role="radio"
                  label={e.label}
                  selected={profile.exam === e.id}
                  onPress={() => s.setExam(e.id)}
                />
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <Card>
        <Txt variant="heading">What you want more time for</Txt>
        <View style={styles.chips}>
          {PRIORITIES.map(p => (
            <Chip
              key={p.id}
              label={p.label}
              selected={settings.priorities.includes(p.id)}
              onPress={() => s.togglePriority(p.id)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Txt variant="heading">Default focus length</Txt>
        <FocusDurationPicker
          minutes={settings.focusMinutes}
          onChange={s.setFocusMinutes}
        />
      </Card>

      <Card>
        <Txt variant="heading">App time insights (optional)</Txt>
        <Txt>{monitoringStatus}</Txt>
        <View style={styles.chips}>
          <Chip
            role="radio"
            label="Set up"
            selected={choice === 'requested'}
            onPress={() => s.setMonitoringChoice('requested')}
          />
          <Chip
            role="radio"
            label="Off"
            selected={choice !== 'requested'}
            onPress={() => s.setMonitoringChoice('declined')}
          />
        </View>
        {choice === 'requested' ? (
          <View style={styles.switchRow}>
            <Txt variant="bodyBold">Pause monitoring</Txt>
            <Switch
              accessibilityLabel="Pause monitoring"
              value={settings.monitoring.paused}
              onValueChange={s.setMonitoringPaused}
              trackColor={{ true: colors.orange, false: colors.sand }}
              thumbColor={colors.card}
            />
          </View>
        ) : null}
        <Txt variant="caption">
          {isMonitoringActive(settings)
            ? 'Monitoring is on.'
            : 'Monitoring is off. Focus sessions and thinking practice still work.'}
        </Txt>
        {lastConsent ? (
          <Txt variant="caption">
            Last choice saved{' '}
            {new Date(lastConsent.recordedAt).toLocaleString()}.
          </Txt>
        ) : null}
      </Card>

      <Card tone="sand" flat>
        <Txt variant="heading">Privacy controls</Txt>
        <Txt>
          Data export and account deletion are not built yet. Everything you set
          here is stored only on this phone.
        </Txt>
      </Card>

      <Txt variant="caption" center>
        RECLAIM · version 0.1 prototype
      </Txt>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET + 4,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
  },
});
