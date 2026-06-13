import React, { memo, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useTheme } from "@/theme";

// ── Deterministic constellation mark ─────────────────────────────────────────
//
// Peers are pseudonymous — the dest hash IS the identity. Raw hash prefixes
// ("0c3", ",EMe") read as noise, so each peer gets a deterministic geometric
// sigil instead: a core node orbited by 3-5 satellite nodes joined by spokes
// and optional chords — a tiny mesh topology. Same hash → same mark, always.
// Everything (node count, rotation, orbit radii, link pattern, accent hue) is
// derived from the hash; nothing is random at render time.

const VB = 44; // design viewBox — geometry scales to any rendered size
const C = VB / 2;

// Accent hues tuned for the void-navy surfaces. Cyan/neon anchor the set to
// the brand palette (theme/colors.ts); the rest fill the wheel so ~8 nearby
// peers stay distinguishable by hue alone.
const ACCENTS = [
  "#00e5ff", // cyan — brand primary
  "#4dffc3", // mint
  "#5cff3b", // neon green — brand accent
  "#ffd166", // amber
  "#ff9e64", // coral
  "#ff7ab8", // pink
  "#b388ff", // violet
  "#7aa2ff", // periwinkle
] as const;

/** 32-bit FNV-1a (standard offset basis 0x811c9dc5 / prime 0x01000193). */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — tiny deterministic PRNG; seeded from the hash, so the "random"
 *  stream is a pure function of the peer identity. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SigilNode {
  x: number;
  y: number;
  r: number;
}

interface SigilSpec {
  accent: string;
  core: SigilNode;
  nodes: SigilNode[];
  /** Path d for core→satellite links. */
  spokes: string;
  /** Path d for satellite→satellite links ('' when the hash draws none). */
  chords: string;
}

function computeSpec(seed: string): SigilSpec {
  const rand = mulberry32(fnv1a(seed));
  // Hue comes from an independent (salted) hash stream so near-identical
  // layouts still split on color, and vice versa. Verified roughly uniform
  // across both random-hex hashes and handle-style fallback seeds.
  const accent = ACCENTS[fnv1a(`${seed}:hue`) % ACCENTS.length];

  const count = 3 + Math.floor(rand() * 3); // 3..5 satellites
  const rotation = rand() * Math.PI * 2;

  const coreAngle = rand() * Math.PI * 2;
  const coreDist = rand() * 4.5;
  const core: SigilNode = {
    x: C + Math.cos(coreAngle) * coreDist,
    y: C + Math.sin(coreAngle) * coreDist,
    r: 3.2,
  };

  const nodes: SigilNode[] = [];
  let spokes = "";
  for (let i = 0; i < count; i++) {
    const jitter = (rand() - 0.5) * 0.5;
    const angle = rotation + (i * Math.PI * 2) / count + jitter;
    const orbit = rand() < 0.5 ? 12.5 : 16.5; // two discrete orbit bands
    const r = rand() < 0.5 ? 2.3 : 3.0;
    const x = C + Math.cos(angle) * orbit;
    const y = C + Math.sin(angle) * orbit;
    nodes.push({ x, y, r });
    spokes += `M${core.x.toFixed(2)} ${core.y.toFixed(2)}L${x.toFixed(2)} ${y.toFixed(2)}`;
  }

  let chords = "";
  for (let i = 0; i < count; i++) {
    if (rand() < 0.45) {
      const a = nodes[i];
      const b = nodes[(i + 1) % count];
      chords += `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    }
  }

  return { accent, core, nodes, spokes, chords };
}

// Specs are tiny and shared across surfaces (drawer row, thread header, map
// node for the same peer) — cache module-wide. Soft cap guards pathological
// growth; normal peer counts never approach it.
const specCache = new Map<string, SigilSpec>();

function specFor(seed: string): SigilSpec {
  let spec = specCache.get(seed);
  if (!spec) {
    if (specCache.size >= 512) specCache.clear();
    spec = computeSpec(seed);
    specCache.set(seed, spec);
  }
  return spec;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface PeerIdenticonProps {
  /** Stable identity string — the peer's LXMF destination hash. */
  seed: string;
  /** Rendered diameter in px. Designed to read at 36-44 row size. */
  size?: number;
  /** Presence affordance — renders the bottom-right status dot when defined,
   *  matching how PeerAvatar rows behave today. */
  online?: boolean;
  /** Container overrides for embedded contexts (map nodes, avatar stacks). */
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export const PeerIdenticon = memo(function PeerIdenticon({
  seed,
  size = 44,
  online,
  backgroundColor,
  borderColor,
  borderWidth = 0.5,
  style,
}: PeerIdenticonProps) {
  const { colors } = useTheme();
  const spec = useMemo(() => specFor(seed), [seed]);

  // Below row size (map nodes, stacks) hairline strokes vanish — thicken the
  // geometry so the sigil still reads as structure.
  const bold = size < 32 ? 1.3 : 1;
  const dotSize = Math.max(8, Math.round(size * 0.25));
  const inner = size - borderWidth * 2;

  return (
    <View
      style={[
        S.box,
        {
          backgroundColor: backgroundColor ?? colors.surface2,
          borderColor: borderColor ?? colors.border,
          borderRadius: size / 2,
          borderWidth,
          height: size,
          width: size,
        },
        style,
      ]}
    >
      <Svg height={inner} viewBox={`0 0 ${VB} ${VB}`} width={inner}>
        {/* Faint hue field — gives each mark its own glow without extra elements */}
        <Circle cx={C} cy={C} fill={spec.accent} fillOpacity={0.07} r={C - 1} />
        {spec.chords !== "" && (
          <Path
            d={spec.chords}
            stroke={spec.accent}
            strokeLinecap="round"
            strokeOpacity={0.28}
            strokeWidth={1.1 * bold}
          />
        )}
        <Path
          d={spec.spokes}
          stroke={spec.accent}
          strokeLinecap="round"
          strokeOpacity={0.5}
          strokeWidth={1.3 * bold}
        />
        {spec.nodes.map((n, i) => (
          <Circle
            cx={n.x}
            cy={n.y}
            fill={spec.accent}
            fillOpacity={0.92}
            key={`${n.x}-${n.y}-${i}`}
            r={n.r * bold}
          />
        ))}
        <Circle cx={spec.core.x} cy={spec.core.y} fill={spec.accent} r={spec.core.r * bold} />
      </Svg>
      {online !== undefined && (
        <View
          style={[
            S.dot,
            {
              backgroundColor: online ? colors.primary : "#3a4a54",
              borderColor: colors.background,
              borderRadius: dotSize / 2,
              height: dotSize,
              width: dotSize,
            },
          ]}
        />
      )}
    </View>
  );
});

const S = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    borderWidth: 2,
    bottom: 0,
    position: "absolute",
    right: 0,
  },
});
