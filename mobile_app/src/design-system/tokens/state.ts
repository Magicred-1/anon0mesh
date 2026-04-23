export const stateTokens = {
  depth: {
    pressInset: "rgba(0, 0, 0, 0.38)",
    pressInsetSub: "rgba(0, 0, 0, 0.24)",
    pressHighlight: "rgba(255, 255, 255, 0.03)",
    restHighlight: "rgba(34, 211, 238, 0.08)",
    bottomInset: "rgba(0, 0, 0, 0.18)",
    restShadow: "rgba(0, 0, 0, 0.32)",
    restShadowSub: "rgba(0, 0, 0, 0.18)",
    pressFill: "rgba(5, 10, 10, 0.18)",
  },
  feedback: {
    disabledOpacity: 0.42,
    buttonPressedOpacity: 0.94,
    listPressedWash: "rgba(255, 255, 255, 0.02)",
    surfaceRowPressWash: "rgba(255, 255, 255, 0.04)",
    surfaceStripPressWash: "rgba(255, 255, 255, 0.03)",
    surfaceCardPressWash: "rgba(255, 255, 255, 0.05)",
    iconPressTint: "rgba(255, 255, 255, 0.14)",
  },
} as const;

export type StateTokens = typeof stateTokens;
