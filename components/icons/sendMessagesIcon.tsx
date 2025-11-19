import { PaperPlaneRight } from 'phosphor-react-native';
import React from 'react';

const SendMessageIcon = ({ size = 32, color }: { size?: number; color?: string }) => {
  return <PaperPlaneRight size={size} color={color} weight="regular" />;
};

export default SendMessageIcon;
