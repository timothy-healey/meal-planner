import React from 'react';
import { View } from 'react-native';
import { colors } from '../../constants/tokens';

export function Divider() {
  return (
    <View style={{ height: 1, backgroundColor: colors.divider }} />
  );
}
