import React from "react";
import { View } from "react-native";
// @ts-ignore
import OctagonTimesSvg from "../../assets/images/icons/octagon_times_icon.svg";

type Props = {
  size?: number;
};

const OctagonTimesIcon = ({ size = 24 }: Props) => {
  return (
    <View style={{ width: size, height: size }}>
      <OctagonTimesSvg width={size} height={size} />
    </View>
  );
};

export default OctagonTimesIcon;
