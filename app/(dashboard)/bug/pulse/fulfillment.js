import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import {
  PULSE_AGENT, PULSE_NAV, usePulseData, FulfillmentBoard, OrderFormModal, nextStatus, updateOrder,
} from '@/components/pulse/PulseKit';

function Fulfillment() {
  const { COLORS } = useTheme();
  const s = getStyles(COLORS);
  const { orders, loading, reload, setOrders } = usePulseData();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const advance = async (o) => {
    const ns = nextStatus(o.status);
    if (!ns) return;
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: ns } : x));
    try { await updateOrder(o.id, { status: ns }); } finally { reload(); }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Fulfillment Pipeline</Text>
        <Text style={s.sub}>Drag orders through the pipeline — tap → to advance, tap a card to edit.</Text>
        <FulfillmentBoard orders={orders} onAdvance={advance} onEdit={(o) => { setEditing(o); setModal(true); }} loading={loading} />
        <View style={{ height: 90 }} />
      </ScrollView>
      <OrderFormModal visible={modal} order={editing} onClose={() => setModal(false)} onSaved={reload} />
    </View>
  );
}

export default function PulseFulfillmentScreen() {
  return <SectionShell agent={PULSE_AGENT} navItems={PULSE_NAV} requirePermission="pulse" title="Pulse · Fulfillment"><Fulfillment /></SectionShell>;
}

const getStyles = (COLORS) => StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  title: { ...TYPOGRAPHY.headlineMd, fontSize: 20, color: COLORS.onSurface, fontWeight: '800' },
  sub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 2, marginBottom: SPACING.lg },
});
