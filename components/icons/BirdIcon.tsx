import React from "react";
import { View } from "react-native";
// @ts-ignore
import BirdSvg from "../../assets/images/icons/bird_icon.svg";

type Props = {
  size?: number;
};

const BirdIcon = ({ size = 24 }: Props) => {
  return (
    <View style={{ width: size, height: size }}>
      <BirdSvg width={size} height={size} />
    </View>
  );
};

export default BirdIcon;
