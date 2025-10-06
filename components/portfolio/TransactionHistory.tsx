import React from "react";
import { YStack, XStack, Text } from "tamagui";
import { AssetIcon } from "@/components/ui/AssetIcon";

interface Transaction {
  id: string;
  type: "swap" | "send" | "receive" | "buy" | "sell";
  asset: string;
  amount: number;
  usdValue: number;
  change?: number;
  changeUsd?: number;
  timestamp: Date;
  status: "completed" | "pending" | "failed";
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

const getTransactionIcon = (
  type: Transaction["type"],
  status: Transaction["status"]
) => {
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

const TransactionItem: React.FC<{ transaction: Transaction }> = ({
  transaction
}) => {
  const { color } = getTransactionIcon(transaction.type, transaction.status);
  const priceUsd = transaction.usdValue;
  const changePercent = transaction.change;
  const changeUsd =
    transaction.changeUsd !== undefined
      ? transaction.changeUsd
      : changePercent !== undefined
      ? (priceUsd * changePercent) / 100
      : undefined;
  const isChangePositive =
    changePercent === undefined ? undefined : changePercent >= 0;
  const formattedTime = (() => {
    const timestamp =
      typeof transaction.timestamp === "string"
        ? new Date(transaction.timestamp)
        : transaction.timestamp;
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return "Just now";
    if (diffMs < hour) return `${Math.floor(diffMs / minute)}m`;
    if (diffMs < day) return `${Math.floor(diffMs / hour)}h`;
    if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d`;

    return timestamp.toLocaleDateString();
  })();

  function renderTransactionType(type: Transaction["type"]) {
    let typeStyleProps = {} as { color: string; backgroundColor: string };
    switch (type) {
      case "send":
        typeStyleProps = { color: "#00C4A2", backgroundColor: "#2DE9C833" };
        break;
      case "receive":
        typeStyleProps = { color: "#FF6F4C", backgroundColor: "#FF6F4C33" };
        break;
      case "buy":
        typeStyleProps = { color: "#947BFF", backgroundColor: "#947BFF33" };
        break;
      case "sell":
        typeStyleProps = { color: "#F8279C", backgroundColor: "#F8279C33" };
        break;
      default:
        typeStyleProps = { color: "#1C252E", backgroundColor: "#1C252E33" };
        break;
    }
    return (
      <Text
        fontSize='$2'
        fontWeight='700'
        color={typeStyleProps.color}
        backgroundColor={typeStyleProps.backgroundColor}
        paddingVertical={4}
        paddingHorizontal={8}
        borderRadius={6}
        textTransform='capitalize'
      >
        {type}
      </Text>
    );
  }

  return (
    <YStack
      borderRadius='$4'
      padding='$4'
      borderBottomColor='#E0E0E0'
      borderBottomWidth={1}
      space='$3'
    >
      <XStack alignItems='center' justifyContent='space-between' width='100%'>
        <XStack alignItems='center' space='$3'>
          <AssetIcon
            symbol={transaction.asset}
            size={36}
            backgroundColor={color}
            fontSize='$3'
            fontWeight='700'
          />
          <Text fontSize='$3' fontWeight='700' color='#1C252E'>
            {transaction.asset}
          </Text>
        </XStack>
        {renderTransactionType(transaction.type)}
      </XStack>

      <YStack space='$2'>
        <XStack alignItems='center' justifyContent='space-between'>
          <Text
            fontSize='$2'
            color='#637381'
            fontWeight='700'
            fontFamily='$numeric'
          >
            Amount:
          </Text>
          <Text
            fontSize='$2'
            color='#637381'
            fontWeight='600'
            fontFamily='$numeric'
          >
            {transaction.amount.toFixed(2)}
          </Text>
        </XStack>

        <XStack alignItems='center' justifyContent='space-between'>
          <Text
            fontSize='$2'
            color='#637381'
            fontWeight='700'
            fontFamily='$numeric'
          >
            Price:
          </Text>
          <Text
            fontSize='$2'
            color='#637381'
            fontWeight='600'
            fontFamily='$numeric'
          >
            ${priceUsd.toFixed(2)}
          </Text>
        </XStack>

        <XStack alignItems='center' justifyContent='space-between' space='$2'>
          <Text
            fontSize='$2'
            color='#637381'
            fontWeight='700'
            fontFamily='$numeric'
          >
            Change:
          </Text>
          {changePercent !== undefined ? (
            <XStack alignItems='center' space='$2'>
              <Text
                fontSize='$2'
                fontWeight='600'
                color={isChangePositive ? "$green10" : "$red10"}
                fontFamily='$numeric'
              >
                {isChangePositive ? "↑" : "↓"}{" "}
                {Math.abs(changePercent).toFixed(2)}%
              </Text>
              {changeUsd !== undefined && (
                <Text
                  fontSize='$2'
                  color={"#637381"}
                  fontWeight='600'
                  fontFamily='$numeric'
                >
                  ({isChangePositive ? "+" : "-"}$
                  {Math.abs(changeUsd).toFixed(2)})
                </Text>
              )}
            </XStack>
          ) : (
            <Text
              fontSize='$2'
              color='#637381'
              fontWeight='700'
              fontFamily='$numeric'
            >
              —
            </Text>
          )}
        </XStack>

        <XStack alignItems='center' justifyContent='space-between'>
          <Text
            fontSize='$2'
            color='#637381'
            fontWeight='700'
            fontFamily='$numeric'
          >
            Time:
          </Text>
          <Text
            fontSize='$2'
            color='#637381'
            fontWeight='600'
            fontFamily='$numeric'
          >
            {formattedTime}
          </Text>
        </XStack>
      </YStack>
    </YStack>
  );
};

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <YStack space='$3'>
        <Text fontSize='$5' fontWeight='600' color='$textPrimary'>
          Transactions
        </Text>
        <YStack space='$2'>
          <Text color='$textSecondary'>Loading transactions...</Text>
        </YStack>
      </YStack>
    );
  }

  if (transactions.length === 0) {
    return (
      <YStack space='$3'>
        <Text fontSize='$5' fontWeight='600' color='$textPrimary'>
          Transactions
        </Text>
        <YStack alignItems='center' paddingVertical='$6'>
          <Text fontSize='$4' color='$gray11' textAlign='center'>
            No transactions yet
          </Text>
          <Text fontSize='$3' color='$gray11' textAlign='center' marginTop='$2'>
            Your transaction history will appear here
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack space='$3' marginVertical='$3'>
      <Text fontSize='$5' fontWeight='600' color='$textPrimary'>
        Transactions
      </Text>
      <YStack space='$2'>
        {transactions.slice(0, 5).map((transaction) => (
          <TransactionItem key={transaction.id} transaction={transaction} />
        ))}
        {transactions.length > 5 && (
          <XStack justifyContent='center' paddingTop='$3'>
            <Text fontSize='$3' color='$blue9' fontWeight='500'>
              View all transactions
            </Text>
          </XStack>
        )}
      </YStack>
    </YStack>
  );
};
