import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppBottomSheet } from '@/components/primitives/BottomSheet';
import { DepthButton } from '@/components/primitives';
import { useTheme } from '@/theme';

/**
 * Themed confirm/destructive dialog on the shared AppBottomSheet primitive.
 * A single <ConfirmHost/> is mounted once in AppShell (see app/_layout.tsx,
 * next to ToastHost) and any module can request a confirmation via the
 * imperative confirm() promise API.
 *
 * This is the app's replacement for multi-button Alert.alert(...) confirms —
 * the only place the app dropped to OS-native UI, breaking the dark/cyan
 * theme on every confirm. Use it for choices that gate an action:
 *
 *   if (await confirm({ title: 'Delete recipient?', destructive: true,
 *                       confirmLabel: 'Delete' })) {
 *     doDestructiveThing();
 *   }
 *
 * Contract (this gates destructive actions — semantics are load-bearing):
 * - Resolves TRUE only when the user taps the confirm button.
 * - Resolves FALSE on cancel button, backdrop tap, or drag-to-dismiss.
 * - The resolver fires exactly once per request.
 * - For transient feedback ("Copied") use showToast, NOT this.
 */

export interface ConfirmOptions {
  readonly title: string;
  readonly message?: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  /** Style the confirm action with the error tone (irreversible actions). */
  readonly destructive?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  readonly resolve: (confirmed: boolean) => void;
}

type Listener = (request: ConfirmRequest) => void;

let listener: Listener | null = null;

/**
 * Request a themed confirmation. Resolves true on confirm, false on
 * cancel/dismiss. No-op resolving false if no <ConfirmHost/> is mounted (so
 * a missing host can never silently fire a destructive action).
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      resolve(false);
      return;
    }
    listener({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const { colors, spacing, textVariants } = useTheme();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [visible, setVisible] = useState(false);

  // Guards the resolver to exactly one call per request, regardless of how
  // the sheet closes (button vs backdrop vs drag, or a confirm tap racing a
  // dismiss). Without this a drag-dismiss firing onClose after a confirm tap
  // could double-resolve.
  const settledRef = useRef(false);

  useEffect(() => {
    listener = (next: ConfirmRequest) => {
      settledRef.current = false;
      setRequest(next);
      setVisible(true);
    };
    return () => {
      listener = null;
    };
  }, []);

  // Resolve the current request once and begin the close animation. The
  // request object is kept mounted until the sheet finishes sliding out
  // (onClose path) so the content doesn't blank mid-animation.
  const settle = useCallback(
    (confirmed: boolean) => {
      if (settledRef.current) return;
      settledRef.current = true;
      request?.resolve(confirmed);
      setVisible(false);
    },
    [request],
  );

  // AppBottomSheet fires onClose on backdrop tap and drag-to-dismiss. Both
  // are an explicit decline → resolve false. (If the confirm button already
  // settled true, settle() is a no-op here, so the close just animates out.)
  const handleClose = useCallback(() => {
    settle(false);
  }, [settle]);

  if (!request) return null;

  return (
    <AppBottomSheet visible={visible} onClose={handleClose}>
      <View style={[S.body, { paddingHorizontal: spacing[2], paddingBottom: spacing[2] }]}>
        <Text style={[textVariants.headingSm, S.title, { color: colors.textPrimary }]}>
          {request.title}
        </Text>
        {request.message ? (
          <Text style={[textVariants.bodyMd, S.message, { color: colors.textSecondary }]}>
            {request.message}
          </Text>
        ) : null}

        <View style={[S.actions, { gap: spacing[4], marginTop: spacing[6] }]}>
          <DepthButton
            label={request.cancelLabel ?? 'Cancel'}
            onPress={() => settle(false)}
            variant="secondary"
            size="lg"
            style={S.action}
          />
          <DepthButton
            label={request.confirmLabel}
            onPress={() => settle(true)}
            variant={request.destructive ? 'danger' : 'primary'}
            tone={request.destructive ? 'red' : 'cyan'}
            size="lg"
            style={S.action}
          />
        </View>
      </View>
    </AppBottomSheet>
  );
}

const S = StyleSheet.create({
  body: {
    paddingTop: 4,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
  },
  action: {
    flex: 1,
  },
});
