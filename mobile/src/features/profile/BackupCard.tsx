import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Txt } from '../../components';
import { cloudAccount, useCloudAccount } from '../../cloud/account';
import { useSettings } from '../../state/SettingsContext';
import { colors } from '../../theme/tokens';

/** Optional Google sign-in for backup. Off unless the person chooses it. */
export function BackupCard() {
  const state = useCloudAccount();
  const s = useSettings();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (state.status === 'loading') {
      cloudAccount.load();
    }
  }, [state.status]);

  if (state.status === 'unavailable') {
    return (
      <Card>
        <Txt variant="heading">Backup</Txt>
        <Txt variant="caption">
          Backup with your Google account is coming soon.
        </Txt>
      </Card>
    );
  }

  const busy = state.status === 'busy' || state.status === 'loading';
  const error = 'error' in state && state.error ? state.error : null;

  if (state.status === 'signedIn' || (state.status === 'busy' && state.email)) {
    const email = state.email;
    return (
      <Card>
        <Txt variant="heading">Backup</Txt>
        <Txt variant="bodyBold">☁️ Signed in{email ? ` as ${email}` : ''}</Txt>
        <Txt variant="caption">
          Settings, focus sessions and gym progress can be backed up. App time,
          reels and the apps and sites you pause stay on this phone.
        </Txt>
        {error ? <Txt color={colors.danger}>{error}</Txt> : null}
        {confirmDelete ? (
          <>
            <Txt variant="bodyBold">
              Delete everything backed up? This phone keeps its own copy.
            </Txt>
            <Button
              label="Yes, delete my backup"
              disabled={busy}
              onPress={async () => {
                if (await cloudAccount.deleteCloudData()) {
                  s.setBackupConsent(false);
                }
                setConfirmDelete(false);
              }}
            />
            <Button
              label="Keep it"
              variant="ghost"
              onPress={() => setConfirmDelete(false)}
            />
          </>
        ) : (
          <View style={styles.row}>
            <Button
              label="Sign out"
              variant="secondary"
              disabled={busy}
              onPress={async () => {
                await cloudAccount.signOut();
                s.setBackupConsent(false);
              }}
            />
            <Button
              label="Delete my backup"
              variant="ghost"
              disabled={busy}
              onPress={() => setConfirmDelete(true)}
            />
          </View>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <Txt variant="heading">Backup (optional)</Txt>
      <Txt>
        ☁️ Keep your settings, focus sessions and gym progress safe for a new
        phone.
      </Txt>
      <Txt>
        📱 App time, reels and the apps and sites you pause never leave this
        phone.
      </Txt>
      <Txt>🗑️ Delete your backup any time.</Txt>
      {error ? <Txt color={colors.danger}>{error}</Txt> : null}
      <Button
        label={busy ? 'Signing in…' : 'Sign in with Google'}
        disabled={busy}
        onPress={async () => {
          if (await cloudAccount.signIn()) {
            s.setBackupConsent(true);
          }
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10 },
});
