import { useLocalSearchParams } from "expo-router";
import React from "react";

import { SuccessCard } from "@/components/send/SuccessCard";

export default function SuccessScreen() {
  const { txId, amount, symbol } = useLocalSearchParams<{
    txId: string;
    amount: string;
    symbol: string;
  }>();

  return (
    <SuccessCard
      txId={txId ?? ""}
      amount={amount ?? "0"}
      symbol={symbol ?? "SOL"}
    />
  );
}
