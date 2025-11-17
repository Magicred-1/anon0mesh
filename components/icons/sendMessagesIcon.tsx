import React from 'react';
import { View } from 'react-native';
// @ts-ignore
import SendMessageSvg from '../../assets/images/icons/send_messages_icon.svg';
const SendMessageIcon = ({ size = 32 }: { size?: number }) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <SendMessageSvg width={size} height={size} />
    </View>
  );
};

export default SendMessageIcon;
