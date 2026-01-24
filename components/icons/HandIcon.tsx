import React from "react";
import { View } from "react-native";
// @ts-ignore
import HandSvg from "../../assets/images/icons/hand_icon.svg";

type Props = {
  size?: number;
};

const HandIcon = ({ size = 16 }: Props) => {
  return (
    <View style={{ width: size, height: size }}>
      <HandSvg width={size} height={size} />
    </View>
  );
};

export default HandIcon;
