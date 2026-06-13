import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { canCreate } from '@/client/permissions';
import { TYPOGRAPHY, SPACING, ROUNDED } from '@/constants';
import SectionShell from '@/components/layout/SectionShell';
import {
  PULSE_AGENT, PULSE_NAV, usePulseData, OrdersTable, OrderFormModal, deleteOrder,
} from '@/components/pulse/PulseKit';

function OrdersManager() {
  const { COLORS } = useTheme();
  const { user } = useAuth();
  const s = getStyles(COLORS);
  const { orders, stats, loading, error, reload } = usePulseData();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);

  // Filter the cached order set client-side — instant, no network round-trips.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o =>
      (filter === 'all' || o.status === filter) &&
      (!q || (o.orderNumber || '').toLowerCase().includes(q) || (o.customer?.name || '').toLowerCase().includes(q) || (o.customer?.email || '').toLowerCase().includes(q))
    );
  }, [orders, filter, search]);

  const onDelete = async (o) => { try { await deleteOrder(o.id); } finally { reload(); } };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.head}>
          <View>
            <Text style={s.title}>Order Management</Text>
            <Text style={s.sub}>{stats.total || 0} total · {stats.byStatus?.pending || 0} pending</Text>
          </View>
          {canCreate(user, 'pulse') && (
            <TouchableOpacity style={s.newBtn} onPress={() => { setEditing(null); setModal(true); }}>
              <MaterialCommunityIcons name="plus" size={18} color={COLORS.onPrimary} /><Text style={s.newText}>New Order</Text>
            </TouchableOpacity>
          )}
        </View>
        {error ? <Text style={s.err}>{String(error.message || error)}</Text> : null}
        <OrdersTable
          orders={filtered} stats={stats} loading={loading && orders.length === 0}
          filter={filter} setFilter={setFilter} search={search} setSearch={setSearch}
          onEdit={(o) => { setEditing(o); setModal(true); }} onDelete={onDelete}
        />
        <View style={{ height: 90 }} />
      </ScrollView>
      <OrderFormModal visible={modal} order={editing} onClose={() => setModal(false)} onSaved={() => reload()} />
    </View>
  );
}

export default function PulseOrdersScreen() {
  return <SectionShell agent={PULSE_AGENT} navItems={PULSE_NAV} requirePermission="pulse" title="Pulse · Orders"><OrdersManager /></SectionShell>;
}

const getStyles = (COLORS) => StyleSheet.create({
  scroll: { padding: SPACING.lg, maxWidth: 980, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  title: { ...TYPOGRAPHY.headlineMd, fontSize: 20, color: COLORS.onSurface, fontWeight: '800' },
  sub: { ...TYPOGRAPHY.bodySm, color: COLORS.onSurfaceVariant, marginTop: 1 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 9, borderRadius: ROUNDED.full },
  newText: { ...TYPOGRAPHY.labelMd, color: COLORS.onPrimary, fontWeight: '700' },
  err: { ...TYPOGRAPHY.bodySm, color: COLORS.error, marginBottom: SPACING.sm },
});
