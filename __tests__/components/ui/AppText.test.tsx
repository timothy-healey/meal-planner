import React from 'react';
import { render } from '@testing-library/react-native';
import { AppText } from '../../../components/ui/AppText';
import { font, colors } from '../../../constants/tokens';

describe('AppText', () => {
  it('renders children', () => {
    const { getByText } = render(<AppText>Hello world</AppText>);
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('applies extrabold font family', () => {
    const { getByText } = render(<AppText weight="extrabold">Title</AppText>);
    expect(getByText('Title').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontFamily: font.family.extrabold }),
      ])
    );
  });

  it('applies green colour', () => {
    const { getByText } = render(<AppText color="green">Label</AppText>);
    expect(getByText('Label').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.green }),
      ])
    );
  });

  it('passes through accessibilityLabel', () => {
    const { getByLabelText } = render(
      <AppText accessibilityLabel="screen title">Shopping List</AppText>
    );
    expect(getByLabelText('screen title')).toBeTruthy();
  });
});
