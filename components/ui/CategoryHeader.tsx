import React from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';
import { Row } from './Row';
import { colors, font, spacing } from '../../constants/tokens';

interface CategoryHeaderProps {
  label: string;
  isOneoff?: boolean;
}

export function CategoryHeader({ label, isOneoff = false }: CategoryHeaderProps) {
  return (
    <Row gap={2} style={{ paddingVertical: spacing[2] }}>
      <View style={{ width: 5, height: 5, borderRadius: 5, backgroundColor: colors.terracotta }} />
      <AppText
        weight="semibold"
        size="2xs"
        color="terracotta"
        style={{ letterSpacing: font.tracking.category }}
      >
        {label.toUpperCase()}
      </AppText>
      {isOneoff && (
        <AppText size="2xs" color="textNote" style={{ marginLeft: spacing[2] }}>
          (check pantry first)
        </AppText>
      )}
    </Row>
  );
}
