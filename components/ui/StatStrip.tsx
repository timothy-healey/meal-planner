import React from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';
import { Card } from './Card';
import { spacing } from '../../constants/tokens';

interface Stat {
  label: string;
  value: string;
  highlight?: boolean;
}

interface StatStripProps {
  stats: Stat[];
}

export function StatStrip({ stats }: StatStripProps) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing[2] }}>
      {stats.map((stat) => (
        <Card key={stat.label} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing[2] }}>
          <AppText size="2xs" color="textSecondary">{stat.label}</AppText>
          <AppText weight="extrabold" size="2xl" color={stat.highlight ? 'orange' : 'textPrimary'}>
            {stat.value}
          </AppText>
        </Card>
      ))}
    </View>
  );
}
