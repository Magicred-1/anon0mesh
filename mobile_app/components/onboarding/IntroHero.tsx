import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { fontFamily, fontSize, spacing } from '@/theme';
import { BG } from './constants';
import { CTAButtons } from './CTAButtons';

// The onboarding story, as three looping scenes. Each is an animated WebP played
// by expo-image (the image pipeline — no video decoder, so nothing can freeze).
// Order: pigeon flyover → flock → receding birds.
const SCENES = [
  require('@/assets/onboarding/scene-flyover.webp'),
  require('@/assets/onboarding/scene-flock.webp'),
  require('@/assets/onboarding/scene-recede.webp'),
];

// Scene pacing. Each scene owns the screen for SLOT ms, then the next scene
// fades in ON TOP over FADE ms (a cover dissolve: only the incoming layer
// animates, so there is no mid-fade brightness dip and nothing else moving).
// A scene is perceivable for at most SLOT + FADE ≈ 5.9s, which sits inside
// every WebP's loop length (flyover 6.02s / flock 6.10s / recede 6.08s) — so
// a scene is always covered BEFORE its loop wraps. The wrap is a hard cut
// back to frame 0; letting it show on screen reads as a janky reset.
const SLOT = 5000;
const FADE = 900;

type Props = Readonly<{
  isLoading: boolean;
  onCreate: () => void;
  onConnect: () => void;
}>;

type Rotation = Readonly<{
  active: number;
  // Per-scene remount counters: bumping one restarts that WebP from frame 0
  // the moment it starts fading in, so playback is deterministic every cycle.
  generation: readonly number[];
  // Per-scene stacking order: the incoming scene always gets the highest
  // zIndex (3) so it covers the outgoing (2) as it fades in.
  zOrder: readonly number[];
}>;

// One screen: the looping three-scene story full-bleed, the hook, and the wallet
// buttons. No separate "Get started" step — one tap to create.
export function IntroHero({ isLoading, onCreate, onConnect }: Props) {
  const insets = useSafeAreaInsets();

  const [rotation, setRotation] = useState<Rotation>({
    active: 0,
    generation: [0, 0, 0],
    zOrder: [3, 1, 1],
  });

  const o0 = useSharedValue(1);
  const o1 = useSharedValue(0);
  const o2 = useSharedValue(0);
  const opacities = useRef([o0, o1, o2]).current;

  const advance = useCallback(() => {
    setRotation((r) => {
      const next = (r.active + 1) % SCENES.length;
      const generation = [...r.generation];
      generation[next] += 1;
      const zOrder = SCENES.map((_, i) => (i === next ? 3 : i === r.active ? 2 : 1));
      return { active: next, generation, zOrder };
    });
  }, []);

  const { active } = rotation;
  useEffect(() => {
    // Cover dissolve: the incoming scene rises 0→1 above the others. Once it
    // is fully opaque the layers underneath are invisible, so they are snapped
    // to 0 (no animation — nothing perceivable changes) ready for their next
    // turn. The outgoing scene keeps playing untouched through the dissolve.
    const incoming = opacities[active];
    incoming.value = 0;
    incoming.value = withTiming(1, {
      duration: FADE,
      easing: Easing.inOut(Easing.ease),
    });
    const cover = setTimeout(() => {
      opacities.forEach((o, i) => {
        if (i !== active) o.value = 0;
      });
    }, FADE + 50);
    const timer = setTimeout(advance, SLOT);
    return () => {
      clearTimeout(cover);
      clearTimeout(timer);
    };
  }, [active, advance, opacities]);

  const s0 = useAnimatedStyle(() => ({ opacity: o0.value }));
  const s1 = useAnimatedStyle(() => ({ opacity: o1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: o2.value }));
  const sceneStyles = [s0, s1, s2];

  return (
    <View style={S.root}>
      {SCENES.map((src, i) => (
        <Animated.View
          key={i}
          style={[StyleSheet.absoluteFill, { zIndex: rotation.zOrder[i] }, sceneStyles[i]]}
          pointerEvents="none"
        >
          <Image
            key={`scene-${i}-${rotation.generation[i]}`}
            source={src}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={0}
            recyclingKey={`scene-${i}`}
            cachePolicy="memory-disk"
          />
        </Animated.View>
      ))}

      <LinearGradient
        colors={['rgba(0,8,12,0.30)', 'rgba(0,8,12,0)', 'rgba(0,8,12,0.66)', 'rgba(0,8,12,0.96)']}
        locations={[0, 0.34, 0.7, 1]}
        style={[StyleSheet.absoluteFill, S.scrim]}
        pointerEvents="none"
      />

      <View style={[S.panel, { paddingBottom: Math.max(24, insets.bottom + 22) }]}>
        <Text style={S.title}>Your messages fly different.</Text>
        <Text style={S.subtitle}>
          Phone to phone. No internet, no accounts, no phone number — your identity is a key.
        </Text>
        <View style={S.buttons}>
          <CTAButtons isLoading={isLoading} onConnect={onConnect} onCreate={onCreate} />
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // The scrim and panel sit above the scene layers (zIndex 1-3).
  scrim: { zIndex: 10 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[7],
    zIndex: 11,
  },
  title: {
    fontFamily: fontFamily.sansBold,
    fontSize: fontSize['4xl'],
    lineHeight: 40,
    color: '#f2fdff',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: 'rgba(216,238,244,0.82)',
    textAlign: 'center',
    marginTop: spacing[3],
  },
  buttons: { marginTop: spacing[6], marginHorizontal: -spacing[7] },
});
