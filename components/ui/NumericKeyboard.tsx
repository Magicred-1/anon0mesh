import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface NumericKeyboardProps {
  readonly onPress: (key: string) => void;
  readonly onBackspace: () => void;
  readonly onDone?: () => void;
  readonly showDoneButton?: boolean;
  readonly onPercentage?: (percentage: number) => void;
  readonly maxAmount?: number;
}

export default function NumericKeyboard({
  onPress,
  onBackspace,
  onDone,
  showDoneButton = true,
  onPercentage,
  maxAmount,
}: NumericKeyboardProps) {
  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "back"],
  ];

  const percentages = [10, 20, 50, "MAX"];

  const renderPercentageButton = (value: number | string) => {
    const isMax = value === "MAX";
    const displayText = isMax ? "Max" : `${value}%`;

    return (
      <TouchableOpacity
        key={value}
        style={styles.percentButton}
        onPress={() => {
          if (!onPercentage || !maxAmount) return;
          const percentage = isMax ? 100 : (value as number);
          onPercentage(percentage);
        }}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={["rgba(34, 211, 238, 0.2)", "rgba(34, 211, 238, 0.1)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.percentGradient}
        >
          <Text style={styles.percentText}>{displayText}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderKey = (key: string) => {
    const isBackspace = key === "back";

    return (
      <TouchableOpacity
        key={key}
        style={styles.keyButton}
        onPress={() => {
          if (isBackspace) {
            onBackspace();
          } else {
            onPress(key);
          }
        }}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={["rgba(34, 211, 238, 0.15)", "rgba(34, 211, 238, 0.05)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.keyGradient}
        >
          <Text style={styles.keyText}>{isBackspace ? "⌫" : key}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.mainLayout}>
        {/* Number Keys Grid */}
        <View style={styles.keysGrid}>
          {keys.map((row) => (
            <View key={row.join("-")} style={styles.row}>
              {row.map(renderKey)}
            </View>
          ))}
        </View>

        {/* Percentage Buttons Column */}
        {onPercentage && (
          <View style={styles.percentColumn}>
            {percentages.map(renderPercentageButton)}
          </View>
        )}
      </View>

      {showDoneButton && onDone && (
        <TouchableOpacity
          style={styles.doneButton}
          onPress={onDone}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#22D3EE", "#0891B2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.doneGradient}
          >
            <Text style={styles.doneText}>Done</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  mainLayout: {
    flexDirection: "row",
    gap: 10,
  },
  percentColumn: {
    justifyContent: "space-between",
    flex: 1,
  },
  percentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    overflow: "hidden",
  },
  percentGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  percentText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#22D3EE",
  },
  keysGrid: {
    flex: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  keyButton: {
    flex: 1,
    height: 42,
    marginHorizontal: 2,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.3)",
  },
  keyGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  keyText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  doneButton: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#22D3EE",
  },
  doneGradient: {
    paddingVertical: 8,
    alignItems: "center",
  },
  doneText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
