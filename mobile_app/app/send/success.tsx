import { useLocalSearchParams } from "expo-router";
import React from "react";

import { SuccessCard } from "@/components/send/SuccessCard";

export default function SuccessScreen() {
  const { txId, amount, symbol, simulated } = useLocalSearchParams<{
    txId: string;
    amount: string;
    symbol: string;
    simulated?: string;
  }>();

  return (
    <SuccessCard
      txId={txId ?? ""}
      amount={amount ?? "0"}
      symbol={symbol ?? "SOL"}
      simulated={simulated === "1"}
    />
  );
}
