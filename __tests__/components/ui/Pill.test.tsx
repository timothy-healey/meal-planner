import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Pill } from '../../../components/ui/Pill';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

describe('Pill', () => {
  it('fires light haptic on press', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Pill label="Save" onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('still calls onPress after haptic', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Pill label="Save" onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
