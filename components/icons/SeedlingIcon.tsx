import React from "react";
import { View } from "react-native";
// @ts-ignore
import SeedlingSvg from "../../assets/images/icons/seedling_icon.svg";

type Props = {
  size?: number;
};

const SeedlingIcon = ({ size = 20 }: Props) => {
  return (
    <View style={{ width: size, height: size }}>
      <SeedlingSvg width={size} height={size} />
    </View>
  );
};

export default SeedlingIcon;
