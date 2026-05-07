import { useLocalSearchParams } from "expo-router";
import React from "react";

import { ReviewCard } from "@/components/send/ReviewCard";

export default function ReviewScreen() {
  const { to, amount, symbol, mint, decimals } = useLocalSearchParams<{
    to: string;
    amount: string;
    symbol: string;
    mint?: string;
    decimals?: string;
  }>();

  return (
    <ReviewCard
      amount={amount ?? "0"}
      decimals={decimals}
      mintAddress={mint}
      symbol={symbol ?? "SOL"}
      to={to ?? ""}
    />
  );
}
