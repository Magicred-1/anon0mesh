import { useLocalSearchParams } from "expo-router";
import React from "react";

import { ReviewCard } from "@/components/send/ReviewCard";

export default function ReviewScreen() {
  const { to, amount, symbol } = useLocalSearchParams<{
    to: string;
    amount: string;
    symbol: string;
  }>();

  return <ReviewCard to={to ?? ""} amount={amount ?? "0"} symbol={symbol ?? "SOL"} />;
}
