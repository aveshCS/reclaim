import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Txt } from '../../components';
import { pauseGate } from '../../native/pauseGate';
import { colors, radius } from '../../theme/tokens';

/**
 * What to do when the pause service isn't running.
 * - Not switched on yet: one trip to Android Settings.
 * - Switched on but stopped (the phone closed it): on Xiaomi/Redmi/POCO, allow Autostart and
 *   set Battery saver to "No restrictions", then switch the service off and on.
 */
export function KeepRunning({
  stopped,
  maker,
  onDone,
}: {
  stopped: boolean;
  maker: string;
  onDone: () => void;
}) {
  const xiaomi = maker === 'xiaomi';
  const openA11y = () => pauseGate.openSettings().then(onDone).catch(() => {});
  if (!stopped) {
    return (
      <View style={styles.box}>
        <Txt variant="bodyBold">Switch it on in Android</Txt>
        <Txt>
          Accessibility ›{xiaomi ? ' Downloaded apps ›' : ''} RECLAIM mindful
          pause › On.
        </Txt>
        <Button label="Open Accessibility settings" onPress={openA11y} />
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <Txt variant="bodyBold">Your phone stopped the pause</Txt>
      {xiaomi ? (
        <>
          <Txt>Xiaomi closes apps to save battery. Two quick fixes:</Txt>
          <Button
            label="1. Allow Autostart"
            variant="secondary"
            onPress={() => pauseGate.openAutostartSettings()}
          />
          <Button
            label="2. Battery saver: No restrictions"
            variant="secondary"
            onPress={() => pauseGate.openAppSettings()}
          />
          <Txt>3. Then switch the pause off and on:</Txt>
        </>
      ) : (
        <Txt>Switch it off and on again in Android Settings:</Txt>
      )}
      <Button label="Open Accessibility settings" onPress={openA11y} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 8,
    backgroundColor: colors.butterSoft,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    padding: 12,
  },
});
