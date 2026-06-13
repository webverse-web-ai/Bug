import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import SectionShell from '@/components/layout/SectionShell';
import { TALLY_AGENT, TALLY_NAV } from '@/components/tally/TallyKit';
import { useVatData, VatRegister, VatFab, exportVatPdf, deleteVatEntry } from '@/components/tally/VatKit';

function Page() {
  const { COLORS } = useTheme();
  const { user } = useAuth();
  const { entries, summary, loading, reload } = useVatData();
  const businessName = user?.team?.businessName || '';

  const onDelete = async (id) => { try { await deleteVatEntry(id); } finally { reload(); } };
  const onExport = (type, list) => exportVatPdf({ entries: list, summary, type, businessName });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: COLORS.onSurface }]}>VAT Register</Text>
        <Text style={[styles.sub, { color: COLORS.onSurfaceVariant }]}>Sales & purchase VAT book · record entries and download as PDF.</Text>
        <VatRegister entries={entries} summary={summary} loading={loading} onDelete={onDelete} onExport={onExport} />
        <View style={{ height: 110 }} />
      </ScrollView>
      <VatFab onSaved={reload} />
    </View>
  );
}

export default function VatRegisterScreen() {
  return <SectionShell agent={TALLY_AGENT} navItems={TALLY_NAV} requirePermission="tally" title="Tally · VAT Register"><Page /></SectionShell>;
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 920, width: '100%', alignSelf: 'center' },
  title: { ...TYPOGRAPHY.headlineMd, fontSize: 20, fontWeight: '800' },
  sub: { ...TYPOGRAPHY.bodySm, marginTop: 2, marginBottom: SPACING.md },
});
