import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { darkColors, fontFamily, fontSize, radii, spacing } from '@/theme';

const CYAN   = darkColors.primary;
const BG     = darkColors.background;
const DIM    = 'rgba(0,229,255,0.35)';
const BORDER = darkColors.border;

interface Props {
  isLoading:       boolean;
  isSolanaMobile:  boolean;
  nickname:        string;
  overlayOpacity:  Animated.Value;
  enteringOpacity: Animated.Value;
  statusOpacity:   Animated.Value;
  nicknameOpacity: Animated.Value;
  btnOpacity:      Animated.Value;
}

function LoadingDots() {
  const dots = [useRef(new Animated.Value(0.15)).current, useRef(new Animated.Value(0.15)).current, useRef(new Animated.Value(0.15)).current];
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    // a11y: under "reduce motion" hold dots at mid-opacity. The "AWAITING
    // WALLET APPROVAL / GENERATING SECURE KEYPAIR" label already conveys
    // progress for screen-reader and motion-sensitive users.
    if (reduceMotion) {
      dots.forEach(d => d.setValue(0.55));
      return;
    }
    const anim = Animated.loop(Animated.stagger(100, dots.map(d =>
      Animated.sequence([
        Animated.timing(d, { toValue: 1,    duration: 160, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0.15, duration: 160, useNativeDriver: true }),
      ])
    )));
    anim.start();
    return () => anim.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);
  return (
    <View style={S.dotsRow}>
      {(['d0', 'd1', 'd2'] as const).map((k, i) => <Animated.View key={k} style={[S.dot, { opacity: dots[i] }]} />)}
    </View>
  );
}

export const LoadingOverlay = memo(function LoadingOverlay({
  isLoading, isSolanaMobile, nickname,
  overlayOpacity, enteringOpacity, statusOpacity, nicknameOpacity, btnOpacity,
}: Readonly<Props>) {
  const cursor   = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();

  // bg fade in/out — independent of parent element animations
  useEffect(() => {
    if (isLoading) {
      setMounted(true);
      Animated.timing(bgOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    } else {
      Animated.timing(bgOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setMounted(false);
      });
    }
  }, [isLoading, bgOpacity]);

  useEffect(() => {
    // a11y: skip the terminal cursor blink under "reduce motion" — keep the
    // underscore visible so the "@nickname_" handle still reads correctly.
    if (reduceMotion) {
      cursor.setValue(isLoading ? 1 : 0);
      return;
    }
    const blink = Animated.loop(Animated.sequence([
      Animated.timing(cursor, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(cursor, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]));
    if (isLoading) blink.start(); else cursor.setValue(0);
    return () => blink.stop();
  }, [isLoading, cursor, reduceMotion]);

  if (!mounted) return null;

  return (
    <Animated.View style={[S.bg, { opacity: bgOpacity }]}>
      <Animated.View style={[S.center, { opacity: overlayOpacity }]}>
        <View style={S.card}>
          <Animated.Text style={[S.label, { opacity: enteringOpacity }]}>
            {isSolanaMobile ? 'CONNECTING' : 'ENTERING MESH'}
          </Animated.Text>
          <Animated.Text style={[S.status, { opacity: statusOpacity }]}>
            {isSolanaMobile ? '[ WALLET ]' : '[ IDENTITY ]'}
          </Animated.Text>
          <View style={S.handleRow}>
            <Animated.Text numberOfLines={1} adjustsFontSizeToFit style={[S.nickname, { opacity: nicknameOpacity }]}>
              @{nickname}
            </Animated.Text>
            <Animated.Text style={[S.cursor, { opacity: cursor }]}>_</Animated.Text>
          </View>
          <View style={S.divider} />
          <Animated.View style={[S.bottomRow, { opacity: btnOpacity }]}>
            <LoadingDots />
            <Text style={S.detail}>
              {isSolanaMobile ? 'AWAITING WALLET APPROVAL' : 'GENERATING SECURE KEYPAIR'}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
});

const S = StyleSheet.create({
  bg:        { ...StyleSheet.absoluteFillObject, backgroundColor: BG, zIndex: 50 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  card:      { width: '100%', backgroundColor: darkColors.surface1, borderRadius: radii['2xl'], borderWidth: 1, borderColor: BORDER, paddingVertical: 44, paddingHorizontal: spacing[8], alignItems: 'center', gap: spacing[5] },
  label:     { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, color: DIM, letterSpacing: 4, textTransform: 'uppercase' },
  status:    { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, color: CYAN, letterSpacing: 4, opacity: 0.5 },
  handleRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing[2], maxWidth: '100%', flexShrink: 1 },
  nickname:  { fontFamily: fontFamily.sansMd, fontSize: fontSize['3xl'], color: CYAN, letterSpacing: 2, fontWeight: '700', flexShrink: 1, minWidth: 0 },
  cursor:    { fontFamily: fontFamily.sansMd, fontSize: fontSize['3xl'], color: CYAN, fontWeight: '700', marginBottom: 3 },
  divider:   { width: 40, height: 0.5, backgroundColor: darkColors.borderStrong, marginVertical: spacing[2] },
  bottomRow: { alignItems: 'center', gap: 14 },
  dotsRow:   { flexDirection: 'row', gap: 10 },
  dot:       { width: 6, height: 6, borderRadius: radii.full, backgroundColor: CYAN },
  detail:    { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, color: DIM, letterSpacing: 2.5, textAlign: 'center' },
});
