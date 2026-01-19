import { useWallet } from "@/src/contexts/WalletContext";
import { createSolanaConnection } from "@/src/utils/solana";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

// Cache for transactions to avoid repeated API calls
let transactionCache: {
  [address: string]: { transactions: Transaction[]; timestamp: number };
} = {};
const CACHE_DURATION = 60000; // 1 minute cache

export interface Transaction {
  id: string;
  type: string;
  address: string;
  amount: string;
  currency: string;
  status: string;
  timestamp: string;
  signature: string;
}

interface UseTransactionHistoryResult {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  walletAddress: string;
  refetch: () => Promise<void>;
}

export function useTransactionHistory(): UseTransactionHistoryResult {
  const { publicKey, isConnected } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");

  const fetchTransactions = useCallback(async () => {
    if (!publicKey) {
      console.log(
        "[useTransactionHistory] No public key available, skipping fetch",
      );
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const address = publicKey.toBase58();
      setWalletAddress(address);
      console.log(
        "[useTransactionHistory] Fetching transactions for:",
        address,
      );

      // Check cache first
      const cached = transactionCache[address];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log("[useTransactionHistory] Using cached transactions");
        setTransactions(cached.transactions);
        setLoading(false);
        return;
      }

      // Create Solana connection with finalized commitment (default, best for rate limits)
      const connection = createSolanaConnection({
        network: "devnet",
        commitment: "finalized",
      });
      const pubKey = new PublicKey(address);

      // Get fewer transaction signatures to avoid rate limits (limit: 5 for minimal API calls)
      const signatureList = await connection.getSignaturesForAddress(pubKey, {
        limit: 5,
      });

      if (signatureList.length === 0) {
        console.log("[useTransactionHistory] No transactions found");
        const emptyResult: Transaction[] = [];
        setTransactions(emptyResult);
        // Cache empty result
        transactionCache[address] = {
          transactions: emptyResult,
          timestamp: Date.now(),
        };
        setLoading(false);
        return;
      }

      // Fetch transaction details one at a time with delays to avoid rate limits
      // This is slower but more reliable with free RPC endpoints
      const transactionDetails: any[] = [];

      for (let i = 0; i < signatureList.length; i++) {
        const signature = signatureList[i].signature;

        try {
          // Use getTransaction with jsonParsed encoding for better performance
          const txDetail = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: "finalized",
          });
          transactionDetails.push(txDetail);

          // Add delay between each request to avoid rate limits (500ms)
          if (i < signatureList.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (txError: any) {
          console.warn(
            "[useTransactionHistory] Transaction fetch error for",
            signature,
            ":",
            txError.message,
          );
          // Push null for failed transactions
          transactionDetails.push(null);
        }
      }

      // Parse transactions
      const parsedTransactions: Transaction[] = signatureList
        .map((txSignature, index) => {
          const txDetail = transactionDetails[index];

          // Skip if transaction detail is null (batch fetch failed)
          if (!txDetail) {
            const date = new Date(txSignature.blockTime! * 1000);
            return {
              id: txSignature.signature,
              type: "Transfer",
              address: "Unknown",
              amount: "0",
              currency: "SOL",
              status:
                txSignature.confirmationStatus === "finalized"
                  ? "Success"
                  : "Pending",
              timestamp: date.toLocaleString("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              signature: txSignature.signature,
            };
          }

          const date = new Date(txSignature.blockTime! * 1000);

          // Determine transaction type and amount
          let type = "Transfer";
          let amount = "0";
          let currency = "SOL";
          let recipientAddress = "Unknown";

          if (txDetail?.transaction.message.instructions) {
            const instructions = txDetail.transaction.message.instructions;

            // Look for transfer instructions
            instructions.forEach((instruction: any) => {
              if (instruction.parsed?.type === "transfer") {
                const info = instruction.parsed.info;
                const lamports = info.lamports || 0;
                amount = (lamports / LAMPORTS_PER_SOL).toFixed(4);

                // Determine if sent or received
                if (info.source === address) {
                  type = "Send";
                  recipientAddress = info.destination;
                } else if (info.destination === address) {
                  type = "Receive";
                  recipientAddress = info.source;
                }
              }
            });
          }

          // Format address (first 4 + last 4 chars)
          const shortAddress =
            recipientAddress.length > 8
              ? `${recipientAddress.slice(0, 4)}...${recipientAddress.slice(-4)}`
              : recipientAddress;

          return {
            id: txSignature.signature,
            type,
            address: shortAddress,
            amount,
            currency,
            status:
              txSignature.confirmationStatus === "finalized"
                ? "Success"
                : "Pending",
            timestamp: date.toLocaleString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            signature: txSignature.signature,
          };
        })
        .filter((tx) => tx !== null); // Remove any null transactions

      console.log(
        "[useTransactionHistory] Fetched",
        parsedTransactions.length,
        "transactions",
      );

      // Cache the results
      transactionCache[address] = {
        transactions: parsedTransactions,
        timestamp: Date.now(),
      };

      setTransactions(parsedTransactions);
    } catch (err: any) {
      console.error(
        "[useTransactionHistory] Error fetching transactions:",
        err,
      );

      // Check if it's a rate limit error
      const isRateLimitError =
        err?.message?.includes("429") ||
        err?.message?.includes("Too many requests");

      if (isRateLimitError) {
        console.warn(
          "[useTransactionHistory] Rate limit hit. Try again in a minute.",
        );
        setError(
          "Rate limit reached. Transaction history will refresh automatically in 1 minute.",
        );
      } else {
        setError("Failed to load transaction history.");
      }

      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    error,
    walletAddress,
    refetch: fetchTransactions,
  };
}
