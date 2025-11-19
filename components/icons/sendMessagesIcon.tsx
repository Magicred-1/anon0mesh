import { PaperPlaneTilt } from 'phosphor-react-native';
import React from 'react';

const SendMessageIcon = ({ size = 32, color }: { size?: number; color?: string }) => {
  return <PaperPlaneTilt size={size} color={color} weight="regular" />;
};

export default SendMessageIcon;
