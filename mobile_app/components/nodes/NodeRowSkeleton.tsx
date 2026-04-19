import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';

export const NodeRowSkeleton = memo(function NodeRowSkeleton() {
  return (
    <View style={S.row}>
      <Skeleton width={28} height={28} radius={4} />
      <View style={S.body}>
        <View style={S.top}>
          <Skeleton width="50%" height={11} />
          <Skeleton width={36} height={16} radius={4} />
        </View>
        <View style={S.meta}>
          <Skeleton width={80} height={8} />
          <Skeleton width={4} height={8} />
          <Skeleton width={40} height={8} />
        </View>
      </View>
      <View style={S.right}>
        <Skeleton width={32} height={16} radius={4} />
        <Skeleton width={22} height={10} radius={2} />
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 20, gap: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  body: { flex: 1, gap: 8 },
  top:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flexDirection: 'row', gap: 8 },
  right:{ alignItems: 'flex-end', gap: 6 },
});
