import React from "react";
import { View } from "react-native";
// @ts-ignore
import HourglassIcon from "../../assets/images/icons/hourglass_icon.svg";

type Props = {
  size?: number;
};

const HourglassMediumIcon = ({ size = 16 }: Props) => {
  return (
    <View style={{ width: size, height: size }}>
      <HourglassIcon width={size} height={size} />
    </View>
  );
};

export default HourglassMediumIcon;
