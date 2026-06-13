import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  InteractionManager, Linking,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFamily, fontSize, radii, spacing, useTheme } from '@/theme';
import { isPeerReachable, useLxmfContext, type LxmfPeer } from '@/context/LxmfContext';
import { useNetworkMode } from '@/src/hooks/useNetworkMode';
import type { NetworkMode } from '@/src/infrastructure/network/types';
import { MeshMap }         from '@/components/nodes/MeshMap';
import { formatAgo }       from '@/utils/time';
import { BeaconRegistry }  from '@/components/nodes/BeaconRegistry';
import { PulseDot }        from '@/components/ui/PulseDot';
import { ScreenHeader }    from '@/components/ui';
import { FILTERS }         from '@/components/nodes/constants';
import type { NodeData, Filter } from '@/components/nodes/types';
import { checkBLEPermissions, requestBLEPermissions, type BLEPermissionStatus } from '@/src/utils/blePermissions';

// Converts a peer to NodeData WITHOUT latency — stable identity for MeshMap.
// Latency is added separately for the list so MeshMap topology doesn't re-layout on every timer tick.
function viaToIface(via: LxmfPeer['via']): 'BLE' | 'TCP' | 'RNode' {
  if (via === 'ble')       return 'BLE';
  if (via === 'rnode')     return 'RNode';
  return 'TCP';
}

function peerToMapNode(p: LxmfPeer, mode: NetworkMode): NodeData {
  // Off-grid, hub-sourced peers are stale announces, not live nodes — dim them.
  const reachable = isPeerReachable(p, mode);
  return {
    handle:   p.displayName.slice(0, 16),
    hops:     p.hops,
    iface:    viaToIface(p.via),
    signal:   reachable ? 4 : 2,
    latency:  '—',
    online:   reachable,
    weak:     false,
    destHash: p.destHash,
    beacon:   p.isBeaconNode,
  };
}

export default function NodesScreen() {
  const { colors } = useTheme();
  const { isRunning, isNativeAvailable, isAnnouncing, bleActive, peers, startBLE, grantRadioConsent } = useLxmfContext();
  const { mode } = useNetworkMode();

  const router = useRouter();

  const handleDirectMessage = useCallback((destHash: string, handle: string) => {
    router.navigate({ pathname: '/(tabs)', params: { destHash, handle } });
  }, [router]);

  const [filter,         setFilter]         = useState<Filter>('all');
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [mapExpanded,    setMapExpanded]    = useState(true);
  // 15s tick — enough precision for "Xs ago" labels, but only while this tab is focused.
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000);
  useFocusEffect(useCallback(() => {
    setNowSec(Date.now() / 1000);
    const id = setInterval(() => setNowSec(Date.now() / 1000), 15_000);
    return () => clearInterval(id);
  }, []));

  // A denied BLE permission must not be a silent dead-end: capture the status so
  // the UI can explain it and offer a re-enable path. Without this, denying once
  // silently kills peer discovery forever — the "scanning forever, no one here"
  // trap with no exit (off-grid #1).
  const [blePerm, setBlePerm] = useState<BLEPermissionStatus | null>(null);

  // Shared post-permission path: if the node is already up, flip the radio on;
  // if it parked at the permission gate (check-only autostart), nudge it.
  const bringRadioUp = useCallback(() => {
    if (isRunning) startBLE();
    else grantRadioConsent();
  }, [isRunning, startBLE, grantRadioConsent]);

  // Explicit affordance — the only place this screen may show the OS dialogs.
  const enableBle = useCallback(async () => {
    if (bleActive) return; // already started — don't re-trigger GATT registration
    const permissionStatus = await requestBLEPermissions();
    setBlePerm(permissionStatus);
    if (permissionStatus !== 'granted' && permissionStatus !== 'not_required') return;
    bringRadioUp();
  }, [bleActive, bringRadioUp]);

  // Focus path is check-only: users who already granted get the radio back
  // without ever seeing a prompt; users who haven't keep the explicit button.
  const ensureBleIfPermitted = useCallback(async () => {
    if (bleActive) return;
    const permissionStatus = await checkBLEPermissions();
    setBlePerm(permissionStatus);
    if (permissionStatus !== 'granted' && permissionStatus !== 'not_required') return;
    bringRadioUp();
  }, [bleActive, bringRadioUp]);

  useFocusEffect(useCallback(() => {
    if (!isNativeAvailable) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      ensureBleIfPermitted();
    });
    return () => task.cancel();
  }, [isNativeAvailable, ensureBleIfPermitted]));

  // Stable node identity: only re-creates when peers change, not on timer ticks.
  // MeshMap receives this — topology layout only runs when peer set actually changes.
  //
  // Pre-AUDIT T7: when !isRunning we returned a 7-item fixture so the radar
  // wouldn't look empty. That was a present-tense lie about the live mesh.
  // Now we return [] and let the empty-state below speak for itself.
  const meshNodes = useMemo<NodeData[]>(
    () => isRunning ? peers.map(p => peerToMapNode(p, mode)) : [],
    [peers, isRunning, mode],
  );

  const bleBlocked = !bleActive && (blePerm === 'denied' || blePerm === 'never_ask_again');
  // Honest empty state: only say "Starting mesh…" while the node is actually
  // coming up. Once it's running with zero peers (every solo user, and the
  // common case), say so plainly instead of implying it's still starting — the
  // same "stop the present-tense lie" pass L4 did for the Messages empty state.
  const emptyStateCopy = !isNativeAvailable
    ? 'Mesh unavailable on this device'
    : bleBlocked
      ? 'Bluetooth permission needed'
      : !isRunning
        ? 'Starting mesh…'
        : 'No peers nearby yet';

  // Fast lookup by destHash for latency enrichment
  const peerMap = useMemo(
    () => new Map(peers.map(p => [p.destHash, p])),
    [peers],
  );

  // List nodes: meshNodes + live latency strings. Re-creates on timer, but meshNodes
  // objects are reused by reference when latency didn't change (avoids NodeRow memo miss).
  const listNodes = useMemo<NodeData[]>(() => {
    return meshNodes.map(n => {
      const p   = peerMap.get(n.destHash ?? '');
      const ago = p && p.lastSeen > 0 ? formatAgo(nowSec - p.lastSeen) : '—';
      if (ago === n.latency) return n; // reuse same ref — NodeRow memo bails out
      return { ...n, latency: ago };
    });
  }, [meshNodes, peerMap, nowSec]);

  const filtered = useMemo(
    () => filter === 'all' ? listNodes : listNodes.filter(n => n.iface === filter),
    [listNodes, filter],
  );

  const ifaceCounts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = { all: listNodes.length, BLE: 0, TCP: 0, RNode: 0 };
    for (const n of listNodes) c[n.iface] = (c[n.iface] ?? 0) + 1;
    return c;
  }, [listNodes]);
  const loading = !isRunning || (isRunning && peers.length === 0);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        <ScreenHeader kicker="ANONMESH" title="peers" style={S.header} />

        {/* Map with filter chips overlaid at bottom */}
        <View style={S.mapWrap}>
          <MeshMap nodes={filtered} selected={selectedHandle} onSelect={setSelectedHandle} syncing={loading} isAnnouncing={isAnnouncing} offGrid={mode !== 'online'} selStripBottom={36} onExpandChange={setMapExpanded} onDirectMessage={handleDirectMessage} />
          {meshNodes.length === 0 && (
            <View pointerEvents="none" style={S.emptyState}>
              <Text style={[S.emptyStateText, { color: colors.textTertiary }]}>
                {emptyStateCopy}
              </Text>
            </View>
          )}
          {mapExpanded && <View style={S.filterOverlay}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterRow}>
              {FILTERS.map(f => {
                const count  = ifaceCounts[f] ?? 0;
                const active = f === filter;
                const isBle  = f === 'BLE';
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={[S.chip, {
                      borderColor:     active ? colors.primary + '80' : colors.border,
                      backgroundColor: active ? colors.primarySubtle  : colors.glass,
                    }]}
                  >
                    {isBle && bleActive && <PulseDot size={4} />}
                    <Text style={[S.chipText, { color: active ? colors.primary : colors.textTertiary }]}>
                      {f.toUpperCase()}
                    </Text>
                    {(isBle ? bleActive : count > 0) && (
                      <Text style={[S.chipCount, { color: active ? colors.primary : colors.textTertiary }]}>
                        {count}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.bottomScroll}>
          {bleBlocked && (
            <View style={[S.bleCard, { borderColor: colors.border, backgroundColor: colors.glass }]}>
              <Text style={[S.bleTitle, { color: colors.textPrimary }]}>Bluetooth is off for anonmesh</Text>
              <Text style={[S.bleBody, { color: colors.textTertiary }]}>
                anonmesh finds people nearby over Bluetooth. Without it, you can only reach peers over the internet —
                so the mesh looks empty even when devices are right next to you.
              </Text>
              <Pressable
                onPress={() => { if (blePerm === 'never_ask_again') { Linking.openSettings(); } else { enableBle(); } }}
                style={[S.bleBtn, { borderColor: colors.primary + '80', backgroundColor: colors.primarySubtle }]}
                accessibilityRole="button"
                accessibilityLabel={blePerm === 'never_ask_again' ? 'Open Settings to enable Bluetooth' : 'Grant Bluetooth access'}
              >
                <Text style={[S.bleBtnText, { color: colors.primary }]}>
                  {blePerm === 'never_ask_again' ? 'Open Settings' : 'Grant Bluetooth access'}
                </Text>
              </Pressable>
            </View>
          )}
          <BeaconRegistry />
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root:          { flex: 1 },
  // ScreenHeader owns layout + typography; keep this screen's wider spacing[6] gutter.
  header:        { paddingHorizontal: spacing[6] },
  mapWrap:       { position: 'relative', paddingHorizontal: spacing[6], paddingTop: 10 },
  filterOverlay: { position: 'absolute', bottom: 8, left: spacing[6], right: spacing[6] },
  filterRow:     { gap: 6, paddingHorizontal: 2 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderRadius: radii.xs },
  chipText:      { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 2, textTransform: 'uppercase' },
  chipCount:     { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.5, opacity: 0.8 },
  bottomScroll:  { paddingBottom: spacing[7] },
  emptyState:    { position: 'absolute', left: 0, right: 0, top: 60, alignItems: 'center' },
  emptyStateText:{ fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 1.5, textTransform: 'uppercase' },
  bleCard:       { marginHorizontal: 20, marginBottom: 14, padding: 14, borderWidth: 0.5, borderRadius: 10, gap: 8 },
  bleTitle:      { fontFamily: fontFamily.sansMd, fontSize: 13, fontWeight: '600' },
  bleBody:       { fontSize: 12, lineHeight: 17 },
  bleBtn:        { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderRadius: 8, marginTop: 2 },
  bleBtnText:    { fontFamily: fontFamily.sansMd, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});
