import React from "react";
import { View } from "react-native";
// @ts-ignore
import PaperIcon from "../../assets/images/icons/paper_plane_icon.svg";

type Props = {
  size?: number;
};

const PaperPlaneIcon = ({ size = 40 }: Props) => {
  return (
    <View style={{ width: size, height: size }}>
      <PaperIcon width={size} height={size} />
    </View>
  );
};

export default PaperPlaneIcon;
