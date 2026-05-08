import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/theme";

// Single source of truth for bottom-sheet behavior across the app. Wraps
// @gorhom/bottom-sheet's imperative BottomSheetModal with our visual chrome
// (handle, backdrop fade tied to drag progress, glass surface) and standard
// physics (snappy spring, flick-to-dismiss, pan-from-anywhere). For sheets
// with internal scroll, use BottomSheetScrollView/BottomSheetFlatList
// re-exported below — gorhom wires the scroll-to-dismiss handoff
// automatically (drag down on scrolled-to-top dismisses; mid-content scrolls
// first, then hands off).
//
// Usage:
//   <AppBottomSheet visible={visible} onClose={() => setVisible(false)}>
//     <YourContent />
//   </AppBottomSheet>

export interface AppBottomSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  /**
   * Snap point (e.g. "60%", "85%"). Omit to use dynamic sizing — the sheet
   * fits its content height. Most consumers want this default.
   */
  readonly snapPoint?: string;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  /** Hide the grab indicator. Apple convention keeps it; rare to disable. */
  readonly hideHandle?: boolean;
}

export interface AppBottomSheetHandle {
  present: () => void;
  dismiss: () => void;
}

export const AppBottomSheet = forwardRef<AppBottomSheetHandle, AppBottomSheetProps>(function AppBottomSheet(
  { visible, onClose, children, snapPoint, contentStyle, backgroundColor, borderColor, hideHandle = false },
  ref,
) {
  const { colors } = useTheme();
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  // Sync imperative gorhom API with declarative `visible` prop. Consumers
  // pass visible/onClose like a regular Modal; this bridges to gorhom.
  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const snapPoints = useMemo(() => (snapPoint ? [snapPoint] : undefined), [snapPoint]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.7}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        S.background,
        {
          backgroundColor: backgroundColor ?? colors.surface0,
          borderColor: borderColor ?? colors.borderStrong,
        },
      ]}
      handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
      handleStyle={hideHandle ? S.handleHidden : S.handle}
      enableDynamicSizing={!snapPoints}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={handleDismiss}
      snapPoints={snapPoints}
    >
      <BottomSheetView style={[S.content, contentStyle]}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
});

// Standalone grab-handle for surfaces that can't move to AppBottomSheet yet
// (route-style modals like the receive screen). Visual matches the gorhom
// indicator so the app feels consistent across the two flavors.
export function BottomSheetHandleBar({ style }: { readonly style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[S.handleBarWrap, style]}>
      <View style={[S.handleBar, { backgroundColor: colors.textTertiary }]} />
    </View>
  );
}

// Re-export gorhom's scroll/list components so consumers don't need a
// separate gorhom import. Use these inside AppBottomSheet content when
// the sheet has scrollable content.
export { BottomSheetScrollView, BottomSheetFlatList } from "@gorhom/bottom-sheet";

const S = StyleSheet.create({
  background: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
  },
  handle: {
    paddingBottom: 8,
    paddingTop: 12,
  },
  handleHidden: {
    height: 0,
    opacity: 0,
    paddingBottom: 0,
    paddingTop: 0,
  },
  content: {
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  handleBarWrap: {
    alignItems: "center",
    paddingBottom: 8,
    paddingTop: 12,
  },
  handleBar: {
    borderRadius: 2,
    height: 4,
    opacity: 0.5,
    width: 36,
  },
});
