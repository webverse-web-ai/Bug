import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import { TALLY_AGENT, TALLY_NAV } from '@/components/tally/TallyKit';
import { VatCalculator } from '@/components/tally/VatKit';

function Page() {
  const { COLORS } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: COLORS.onSurface }]}>VAT Calculator</Text>
      <Text style={[styles.sub, { color: COLORS.onSurfaceVariant }]}>Quickly add or extract 13% VAT for any amount.</Text>
      <VatCalculator />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

export default function VatCalculatorScreen() {
  return <SectionShell agent={TALLY_AGENT} navItems={TALLY_NAV} requirePermission="tally" title="Tally · VAT Calculator"><Page /></SectionShell>;
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 620, width: '100%', alignSelf: 'center' },
  title: { ...TYPOGRAPHY.headlineMd, fontSize: 20, fontWeight: '800' },
  sub: { ...TYPOGRAPHY.bodySm, marginTop: 2, marginBottom: SPACING.md },
});
