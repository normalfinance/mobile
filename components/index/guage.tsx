import React, { useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PanGestureHandlerGestureEvent
} from "react-native-gesture-handler";
import Svg, { Path, Circle, G } from "react-native-svg";

interface SemiCircleGaugeProps {
  size?: number;
  minValue?: number;
  maxValue?: number;
  initialValue?: number;
  strokeWidth?: number;
  activeColor?: string;
  inactiveColor?: string;
  knobColor?: string;
  onValueChange?: (value: number) => void;
}

const SemiCircleGauge: React.FC<SemiCircleGaugeProps> = ({
  size = 300,
  minValue = 0,
  maxValue = 100,
  initialValue = 50,
  strokeWidth = 20,
  activeColor = "#4CAF50",
  inactiveColor = "#E0E0E0",
  knobColor = "#2196F3",
  onValueChange
}) => {
  const [value, setValue] = useState(initialValue);
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size / 2;

  // Convert value to angle (180 degrees for semi-circle)
  const valueToAngle = (val: number): number => {
    const percentage = (val - minValue) / (maxValue - minValue);
    return 270 + percentage * 180; // 270 to 450 degrees (270 to 90 with wrap)
  };

  // Convert angle to value
  const angleToValue = (angle: number): number => {
    const normalizedAngle = ((angle % 360) + 360) % 360;
    let adjustedAngle = normalizedAngle;

    // Handle the 270-450 range (270-360 and 0-90)
    if (adjustedAngle >= 270) {
      adjustedAngle = adjustedAngle - 270; // Convert 270-360 to 0-90
    } else if (adjustedAngle <= 90) {
      adjustedAngle = adjustedAngle + 90; // Convert 0-90 to 90-180
    } else {
      // Outside valid range, clamp to nearest edge
      adjustedAngle = adjustedAngle < 180 ? 0 : 180;
    }

    // Clamp to 0-180 range
    if (adjustedAngle < 0) adjustedAngle = 0;
    if (adjustedAngle > 180) adjustedAngle = 180;

    const percentage = adjustedAngle / 180;
    return minValue + percentage * (maxValue - minValue);
  };

  // Create arc path
  const createArcPath = (startAngle: number, endAngle: number): string => {
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M",
      start.x,
      start.y,
      "A",
      radius,
      radius,
      0,
      largeArc,
      0,
      end.x,
      end.y
    ].join(" ");
  };

  const polarToCartesian = (
    cx: number,
    cy: number,
    r: number,
    angle: number
  ) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(radians),
      y: cy + r * Math.sin(radians)
    };
  };

  // Handle gesture
  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const { x, y } = event.nativeEvent;
    const dx = x - centerX;
    const dy = y - centerY;

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;

    // Constrain angle to 270-90 range (bottom arc, left to right)
    if (angle > 90 && angle < 270) {
      // Outside valid range, snap to nearest edge
      if (angle < 180) {
        angle = 90; // Snap to right edge
      } else {
        angle = 270; // Snap to left edge
      }
    }

    const newValue = angleToValue(angle);
    const clampedValue = Math.max(minValue, Math.min(maxValue, newValue));

    setValue(clampedValue);
    onValueChange?.(clampedValue);
  };

  const currentAngle = valueToAngle(value);
  const knobPosition = polarToCartesian(centerX, centerY, radius, currentAngle);

  // Calculate positions for min/max labels at arc endpoints
  const minLabelPosition = polarToCartesian(
    centerX,
    centerY,
    radius - strokeWidth - 10,
    270
  );
  const maxLabelPosition = polarToCartesian(
    centerX,
    centerY,
    radius - strokeWidth - 10,
    90
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <View
        style={[
          styles.gaugeContainer,
          { width: size + 2, height: (size + 25) / 2, overflow: "hidden" }
        ]}
      >
        <PanGestureHandler onGestureEvent={onGestureEvent}>
          <View>
            <Svg width={size + 2} height={size + 2}>
              <G>
                {/* Background arc */}
                <Path
                  d={createArcPath(270, 90)}
                  stroke={inactiveColor}
                  strokeWidth={strokeWidth}
                  fill='none'
                  strokeLinecap='round'
                />

                {/* Active arc */}
                <Path
                  d={createArcPath(270, currentAngle)}
                  stroke={activeColor}
                  strokeWidth={strokeWidth}
                  fill='none'
                  strokeLinecap='round'
                />

                {/* Knob */}
                <Circle
                  cx={knobPosition.x}
                  cy={knobPosition.y}
                  r={strokeWidth * 0.8}
                  fill={knobColor}
                  stroke='#FFFFFF'
                  strokeWidth={3}
                  zIndex={100}
                />
              </G>
            </Svg>
          </View>
        </PanGestureHandler>

        {/* Allocation text spanning horizontally across bottom */}
        <View
          style={[
            styles.allocationContainer,
            {
              left: minLabelPosition.x - 20,
              top: minLabelPosition.y - 35,
              width: maxLabelPosition.x - minLabelPosition.x + 40
            }
          ]}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              color: "#333",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center"
            }}
          >
            {Math.round(value)}
          </Text>
          <Text style={styles.allocationText}>Used percent of allocation</Text>
        </View>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20
  },
  gaugeContainer: {
    justifyContent: "flex-start",
    alignItems: "center",
    position: "relative"
  },
  valueContainer: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    alignItems: "center"
  },
  valueText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#333"
  },
  labelText: {
    fontSize: 14,
    color: "#666",
    marginTop: 4
  },
  allocationContainer: {
    flexDirection: "column",
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    height: 40
  },
  allocationText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    textAlign: "center"
  }
});

export default SemiCircleGauge;
