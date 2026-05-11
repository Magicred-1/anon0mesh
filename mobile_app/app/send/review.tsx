import { useLocalSearchParams } from "expo-router";
import React from "react";

import { ReviewCard } from "@/components/send/ReviewCard";

export default function ReviewScreen() {
  const { to, amount, symbol, mint, decimals, programId, memo } = useLocalSearchParams<{
    to: string;
    amount: string;
    symbol: string;
    mint?: string;
    decimals?: string;
    programId?: string;
    memo?: string;
  }>();

  return (
    <ReviewCard
      amount={amount ?? "0"}
      decimals={decimals}
      mintAddress={mint}
      memo={memo}
      programId={programId}
      symbol={symbol ?? "SOL"}
      to={to ?? ""}
    />
  );
}
