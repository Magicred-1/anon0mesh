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

  // The in-flight request's resolver, held in a ref so it survives re-renders.
  // Tracking the resolver (not just a settled flag) lets every exit path honor
  // the "resolves exactly once" contract: settle() nulls it so a drag-dismiss
  // racing a confirm tap can't double-resolve; a *new* request declines the open
  // one instead of leaking its promise; host unmount declines rather than hangs.
  // Null = nothing in flight.
  const pendingRef = useRef<((confirmed: boolean) => void) | null>(null);

  useEffect(() => {
    listener = (next: ConfirmRequest) => {
      // A second confirm() arriving while one is still open would otherwise
      // orphan the first awaiter forever — decline it (false) before swapping.
      // No-op if the prior already settled (pendingRef is null).
      pendingRef.current?.(false);
      pendingRef.current = next.resolve;
      setRequest(next);
      setVisible(true);
    };
    return () => {
      // Unmounting with a request still open would hang its awaiter — decline it.
      pendingRef.current?.(false);
      pendingRef.current = null;
      listener = null;
    };
  }, []);

  // Resolve the in-flight request exactly once and begin the close animation.
  // Nulling pendingRef first makes this idempotent: a backdrop/drag dismiss
  // firing onClose right after a confirm tap finds nothing pending and no-ops.
  // The request stays mounted until the sheet slides out so content doesn't blank.
  const settle = useCallback((confirmed: boolean) => {
    const resolve = pendingRef.current;
    if (!resolve) return;
    pendingRef.current = null;
    resolve(confirmed);
    setVisible(false);
  }, []);

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
