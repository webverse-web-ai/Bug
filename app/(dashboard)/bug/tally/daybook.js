import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Loader from '@/components/ui/Loader';
import { TYPOGRAPHY, SPACING } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import { TALLY_AGENT, TALLY_NAV, useTallyData, Daybook, TallyFab, deleteTransaction } from '@/components/tally/TallyKit';

function Page() {
  const { COLORS } = useTheme();
  const { data, parties, loading, reload } = useTallyData();
  const onDelete = async (id) => { try { await deleteTransaction(id); } finally { reload(); } };
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: COLORS.onSurface }]}>Daybook</Text>
        <Text style={[styles.sub, { color: COLORS.onSurfaceVariant }]}>Every entry, newest first — grouped by day.</Text>
        <Daybook transactions={data.transactions} onDelete={onDelete} loading={loading || !data.reports} />
        <View style={{ height: 90 }} />
      </ScrollView>
      <TallyFab parties={parties} onSaved={reload} />
    </View>
  );
}
export default function TallyDaybookScreen() {
  return <SectionShell agent={TALLY_AGENT} navItems={TALLY_NAV} requirePermission="tally" title="Tally · Daybook"><Page /></SectionShell>;
}
const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 820, width: '100%', alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { ...TYPOGRAPHY.headlineMd, fontSize: 20, fontWeight: '800' },
  sub: { ...TYPOGRAPHY.bodySm, marginTop: 2, marginBottom: SPACING.md },
});
