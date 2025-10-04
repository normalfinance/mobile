import React from "react";
import { YStack, XStack, Text, Circle } from "tamagui";

interface Transaction {
  id: string;
  type: "swap" | "send" | "receive" | "buy" | "sell";
  asset: string;
  amount: number;
  usdValue: number;
  change?: number;
  timestamp: Date;
  status: "completed" | "pending" | "failed";
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

const getTransactionIcon = (type: Transaction["type"], status: Transaction["status"]) => {
  const iconMap = {
    swap: { icon: "⇄", color: "$blue9" },
    send: { icon: "↗", color: "$red9" },
    receive: { icon: "↙", color: "$green9" },
    buy: { icon: "+", color: "$green9" },
    sell: { icon: "−", color: "$red9" }
  };
  
  const config = iconMap[type];
  return {
    icon: config.icon,
    color: status === "failed" ? "$gray8" : config.color
  };
};

const TransactionItem: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
  const { icon, color } = getTransactionIcon(transaction.type, transaction.status);
  const isPositive = transaction.type === "receive" || transaction.type === "buy";
  const amountPrefix = isPositive ? "+" : "-";
  
  return (
    <XStack 
      alignItems="center" 
      justifyContent="space-between" 
      paddingVertical="$3"
    >
      <XStack alignItems="center" space="$3" flex={1}>
        <Circle size={32} backgroundColor={color}>
          <Text fontSize="$3" color="white" fontWeight="700">
            {icon}
          </Text>
        </Circle>
        <YStack alignItems="flex-start">
          <Text fontSize="$4" fontWeight="600" color="$textPrimary" textTransform="capitalize">
            {transaction.type}
          </Text>
          <XStack alignItems="center" space="$2">
            <Text fontSize="$3" color="$gray11">
              {transaction.asset}
            </Text>
            {transaction.status !== "completed" && (
              <Text 
                fontSize="$2" 
                color={transaction.status === "pending" ? "$orange9" : "$red9"}
                textTransform="capitalize"
              >
                {transaction.status}
              </Text>
            )}
          </XStack>
        </YStack>
      </XStack>
      
      <YStack alignItems="flex-end">
        <Text 
          fontSize="$4" 
          fontWeight="600" 
          color={isPositive ? "$green10" : "$textPrimary"}
        >
          {amountPrefix}{transaction.amount.toFixed(4)}
        </Text>
        <XStack alignItems="center" space="$1">
          <Text fontSize="$3" color="$gray11">
            ${transaction.usdValue.toFixed(2)}
          </Text>
          {transaction.change !== undefined && (
            <Text 
              fontSize="$3" 
              color={transaction.change >= 0 ? "$green10" : "$red10"}
            >
              {transaction.change >= 0 ? "+" : ""}{transaction.change.toFixed(2)}%
            </Text>
          )}
        </XStack>
      </YStack>
    </XStack>
  );
};

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <YStack space="$3">
        <Text fontSize="$5" fontWeight="600" color="$textPrimary">
          Transactions
        </Text>
        <YStack space="$2">
          <Text color="$textSecondary">Loading transactions...</Text>
        </YStack>
      </YStack>
    );
  }

  if (transactions.length === 0) {
    return (
      <YStack space="$3">
        <Text fontSize="$5" fontWeight="600" color="$textPrimary">
          Transactions
        </Text>
        <YStack alignItems="center" paddingVertical="$6">
          <Text fontSize="$4" color="$gray11" textAlign="center">
            No transactions yet
          </Text>
          <Text fontSize="$3" color="$gray11" textAlign="center" marginTop="$2">
            Your transaction history will appear here
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack space="$3">
      <Text fontSize="$5" fontWeight="600" color="$textPrimary">
        Transactions
      </Text>
      <YStack space="$2">
        {transactions.slice(0, 5).map((transaction) => (
          <TransactionItem key={transaction.id} transaction={transaction} />
        ))}
        {transactions.length > 5 && (
          <XStack justifyContent="center" paddingTop="$3">
            <Text fontSize="$3" color="$blue9" fontWeight="500">
              View all transactions
            </Text>
          </XStack>
        )}
      </YStack>
    </YStack>
  );
};