import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Loader from '@/components/ui/Loader';
import { SPACING } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import { TALLY_AGENT, TALLY_NAV, useTallyData, TallyOverview, TallyFab } from '@/components/tally/TallyKit';

function Dashboard() {
  const { COLORS } = useTheme();
  const { data, parties, loading, error, reload } = useTallyData();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error ? <Text style={{ color: COLORS.error, marginBottom: SPACING.md }}>{error}</Text> : null}
        <TallyOverview data={data} loading={loading || !data.reports} />
        <View style={{ height: 90 }} />
      </ScrollView>
      <TallyFab parties={parties} onSaved={reload} />
    </View>
  );
}

export default function TallyDashboardScreen() {
  return <SectionShell agent={TALLY_AGENT} navItems={TALLY_NAV} requirePermission="tally" title="Tally · Dashboard"><Dashboard /></SectionShell>;
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 880, width: '100%', alignSelf: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
