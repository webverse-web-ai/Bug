import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import { TALLY_AGENT, TALLY_NAV } from '@/components/tally/TallyKit';
import { useVatData } from '@/components/tally/VatKit';
import { SalesBillGenerator } from '@/components/tally/BillKit';

function Page() {
  const { COLORS } = useTheme();
  const { reload } = useVatData();
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: COLORS.onSurface }]}>Sales VAT Bill</Text>
      <Text style={[styles.sub, { color: COLORS.onSurfaceVariant }]}>Build a tax invoice with line items — saves to the VAT register and exports a PDF.</Text>
      <SalesBillGenerator onSaved={reload} />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

export default function VatBillScreen() {
  return <SectionShell agent={TALLY_AGENT} navItems={TALLY_NAV} requirePermission="tally" title="Tally · Sales VAT Bill"><Page /></SectionShell>;
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { ...TYPOGRAPHY.headlineMd, fontSize: 20, fontWeight: '800' },
  sub: { ...TYPOGRAPHY.bodySm, marginTop: 2, marginBottom: SPACING.md },
});
