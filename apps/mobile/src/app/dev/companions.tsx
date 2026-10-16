import type { ConfigIssue, DevCharacterResponse } from '@after-hours/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COMPANIONS_QUERY_KEY, useCompanions } from '@/api/companions';
import { DEV_EDITOR_ENABLED } from '@/api/config';
import { fetchDevCharacter, saveDevCharacter } from '@/api/dev-companions';
import { BackButton } from '@/components/back-button';
import { PrimaryButton } from '@/components/primary-button';
import { SpotlightCard } from '@/components/discovery/spotlight-card';
import {
  buildOverride,
  CORE_FIELDS,
  coreValuesFrom,
  parseAdvanced,
  type CoreValues,
} from '@/dev/override-fields';
import { colors, fonts, radius, spacing, type } from '@/theme/tokens';

const MAX_WIDTH = 560;
const devQueryKey = (id: string) => ['dev-character', id] as const;

/**
 * Local character editor. Hidden unless EXPO_PUBLIC_DEV_EDITOR=true; the server also
 * requires DEV_EDITOR=true and a localhost connection. Saves to config/companions.local.json.
 */
export default function DevCompanionsScreen() {
  if (!DEV_EDITOR_ENABLED) return <Redirect href="/" />;
  return <DevEditor />;
}

function DevEditor() {
  const { data: list } = useCompanions();
  const ids = list?.companions.map((c) => ({ id: c.id, name: c.name })) ?? [];
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const selected = picked ?? ids[0]?.id;

  const query = useQuery({
    queryKey: devQueryKey(selected ?? ''),
    queryFn: () => fetchDevCharacter(selected ?? ''),
    enabled: selected !== undefined,
    retry: false,
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <BackButton />
          <Text style={type.title}>Character editor</Text>
        </View>
        <Text style={type.caption}>
          Dev only. Saves a validated override to config/companions.local.json (git-ignored).
          Presets are never modified.
        </Text>

        <View style={styles.row}>
          {ids.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => setPicked(item.id)}
              style={[styles.tab, item.id === selected && styles.tabActive]}
            >
              <Text style={styles.tabText}>{item.name}</Text>
            </Pressable>
          ))}
        </View>

        {query.isPending ? <ActivityIndicator color={colors.textMuted} /> : null}
        {query.error ? <Text style={styles.error}>{query.error.message}</Text> : null}
        {query.data ? (
          <EditorForm key={`${query.data.id}:${query.dataUpdatedAt}`} data={query.data} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EditorForm({ data }: { data: DevCharacterResponse }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<CoreValues>(() => coreValuesFrom(data.merged));
  const [advanced, setAdvanced] = useState(() => JSON.stringify(data.override ?? {}, null, 2));
  const [issues, setIssues] = useState<ConfigIssue[]>(data.issues);
  const [message, setMessage] = useState<string | null>(
    data.valid ? null : 'The override on disk is invalid; the preset is in use.',
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsed = parseAdvanced(advanced);
    if (!parsed.ok) {
      setMessage(parsed.error);
      return;
    }
    setSaving(true);
    try {
      const result = await saveDevCharacter(
        data.id,
        buildOverride(parsed.value, values, data.preset),
      );
      if (result.ok) {
        queryClient.setQueryData(devQueryKey(data.id), result.data);
        await queryClient.invalidateQueries({ queryKey: COMPANIONS_QUERY_KEY });
        return;
      }
      setIssues(result.data?.issues ?? []);
      setMessage(result.error);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const preview = { ...data.public, name: values.name, tagline: values.tagline };

  return (
    <View style={styles.form}>
      <View style={styles.preview}>
        <SpotlightCard companion={preview} width={280} onOpen={() => {}} />
      </View>

      {CORE_FIELDS.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={type.label}>{field.label}</Text>
          <TextInput
            value={values[field.key]}
            onChangeText={(text) => setValues((prev) => ({ ...prev, [field.key]: text }))}
            multiline={field.kind === 'multiline' || field.kind === 'lines'}
            keyboardType={field.kind === 'number' ? 'number-pad' : 'default'}
            style={[styles.input, field.kind !== 'text' && field.kind !== 'number' && styles.tall]}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      ))}

      <View style={styles.field}>
        <Text style={type.label}>Advanced: override JSON (deep partial; fields above win)</Text>
        <TextInput
          value={advanced}
          onChangeText={setAdvanced}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, styles.code]}
        />
      </View>

      {message ? <Text style={styles.error}>{message}</Text> : null}
      {issues.map((issue) => (
        <Text key={`${issue.path}:${issue.message}`} style={styles.error}>
          {issue.path}: {issue.message}
        </Text>
      ))}

      <PrimaryButton label={saving ? 'Saving…' : 'Save override'} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    marginHorizontal: 'auto',
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: -spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tabActive: { backgroundColor: colors.surfaceRaised },
  tabText: { ...type.secondary, color: colors.text },
  form: { gap: spacing.lg },
  preview: { alignItems: 'center' },
  field: { gap: spacing.xs },
  input: {
    ...type.body,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tall: { minHeight: 96, textAlignVertical: 'top' },
  code: { minHeight: 160, fontFamily: fonts.regular, fontSize: 13, textAlignVertical: 'top' },
  error: { ...type.caption, color: colors.danger },
});
