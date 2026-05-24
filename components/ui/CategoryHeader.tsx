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
      <View style={{ width: 7, height: 7, borderRadius: 7, backgroundColor: colors.terracotta }} />
      <AppText
        weight="semibold"
        size="md"
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
