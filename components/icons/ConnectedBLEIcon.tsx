import React from "react";
import { View } from "react-native";
// @ts-ignore
import BLEIcon from "../../assets/images/icons/bluetooth_connected_icon.svg";

type Props = {
  size?: number;
};

const ConnectedBLEIcon = ({ size = 40 }: Props) => {
  return (
    <View style={{ width: size, height: size }}>
      <BLEIcon width={size} height={size} />
    </View>
  );
};

export default ConnectedBLEIcon;
