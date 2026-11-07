import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, ErrorState, LoadingState, Txt } from '../../components';
import {
  LaunchableApp,
  MAX_PACKAGES_PER_CALL,
  usageStats,
} from '../../native/usageStats';
import { MAX_TRACKED_APPS, TrackedApp } from '../../state/settings';
import { colors, fonts, MIN_TOUCH_TARGET, radius } from '../../theme/tokens';
import { formatDuration, startOfLocalDayDaysAgo } from '../../utils/time';

type Candidate = LaunchableApp & { weekMs: number };

type Props = {
  visible: boolean;
  initial: TrackedApp[];
  onCancel: () => void;
  onSave: (apps: TrackedApp[]) => void;
  title?: string;
};

/**
 * Lets the user choose which apps to see time for. Apps are listed by recent use so
 * people can find them quickly, but nothing is pre-selected or labelled as "bad".
 */
export function AppPicker({
  visible,
  initial,
  onCancel,
  onSave,
  title = 'Which apps do you want to see?',
}: Props) {
  const insets = useSafeAreaInsets();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initial.map(a => a.packageName)),
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    let alive = true;
    setPicked(new Set(initial.map(a => a.packageName)));
    setQuery('');
    setError(null);
    setCandidates(null);
    (async () => {
      try {
        const apps = await usageStats.getLaunchableApps();
        const now = Date.now();
        const start = startOfLocalDayDaysAgo(now, 6);
        const week = new Map<string, number>();
        // Sorting by recent use needs Usage Access; without it, fall back to A–Z.
        if (await usageStats.hasPermission()) {
          for (let i = 0; i < apps.length; i += MAX_PACKAGES_PER_CALL) {
            const chunk = apps
              .slice(i, i + MAX_PACKAGES_PER_CALL)
              .map(a => a.packageName);
            try {
              const s = await usageStats.getSummary(start, now, chunk);
              s.apps.forEach(a => week.set(a.packageName, a.foregroundMs));
            } catch {
              break;
            }
          }
        }
        if (alive) {
          setCandidates(
            apps
              .map(a => ({ ...a, weekMs: week.get(a.packageName) ?? 0 }))
              .sort(
                (x, y) => y.weekMs - x.weekMs || x.label.localeCompare(y.label),
              ),
          );
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : 'Could not list apps.');
        }
      }
    })();
    return () => {
      alive = false;
    };
    // Re-load each time the picker opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (candidates ?? []).filter(
      c =>
        !q ||
        c.label.toLowerCase().includes(q) ||
        c.packageName.toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const toggle = (pkg: string) =>
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(pkg)) {
        next.delete(pkg);
      } else if (next.size < MAX_TRACKED_APPS) {
        next.add(pkg);
      }
      return next;
    });

  const save = () => {
    const byPkg = new Map((candidates ?? []).map(c => [c.packageName, c]));
    initial.forEach(a => {
      if (!byPkg.has(a.packageName)) {
        byPkg.set(a.packageName, { ...a, weekMs: 0 });
      }
    });
    onSave(
      Array.from(picked)
        .map(p => byPkg.get(p))
        .filter((c): c is Candidate => !!c)
        .map(c => ({ packageName: c.packageName, label: c.label })),
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <Txt variant="title">{title}</Txt>
        <Txt>
          Pick the ones you'd like to use less.
          {candidates?.some(c => c.weekMs > 0)
            ? ' Sorted by your use in the last 7 days.'
            : ''}{' '}
          You can change this any time.
        </Txt>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search apps"
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel="Search apps"
          style={styles.search}
        />
        {error ? (
          <ErrorState message={error} />
        ) : candidates === null ? (
          <LoadingState label="Finding your apps" />
        ) : (
          <FlatList
            style={styles.list}
            data={shown}
            keyExtractor={c => c.packageName}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Chip
                block
                label={item.label}
                selected={picked.has(item.packageName)}
                onPress={() => toggle(item.packageName)}
              />
            )}
            ListEmptyComponent={<Txt center>No apps match.</Txt>}
            ListHeaderComponent={
              <Txt variant="caption">
                {picked.size} selected
                {picked.size >= MAX_TRACKED_APPS
                  ? ` (maximum ${MAX_TRACKED_APPS})`
                  : ''}
              </Txt>
            }
            initialNumToRender={20}
          />
        )}
        {candidates && shown.length > 0 && shown[0].weekMs > 0 ? (
          <Txt variant="caption">
            Most used this week: {shown[0].label} (
            {formatDuration(shown[0].weekMs)})
          </Txt>
        ) : null}
        <View style={styles.footer}>
          <Button
            label={`Save ${picked.size} app${picked.size === 1 ? '' : 's'}`}
            onPress={save}
            disabled={candidates === null && initial.length === 0}
          />
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: 24,
    gap: 12,
  },
  search: {
    minHeight: MIN_TOUCH_TARGET + 4,
    backgroundColor: colors.card,
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
  },
  list: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 12 },
  footer: { gap: 2 },
});
