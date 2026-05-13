import { Stack, useLocalSearchParams } from "expo-router";
import React from "react";

import { FailureCard } from "@/components/send/FailureCard";

export default function FailureScreen() {
  const params = useLocalSearchParams<{
    txId?: string;
    amount?: string;
    symbol?: string;
    subtitle?: string;
    pillLabel?: string;
    rawError?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <FailureCard
        txId={asString(params.txId)}
        amount={asString(params.amount, "0")}
        symbol={asString(params.symbol, "SOL")}
        subtitle={asString(params.subtitle, "Transaction failed.")}
        pillLabel={asString(params.pillLabel, "Failed")}
        rawError={asString(params.rawError)}
      />
    </>
  );
}

function asString(value: string | string[] | undefined, fallback = ""): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return fallback;
}
