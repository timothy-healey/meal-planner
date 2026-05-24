import React from 'react';
import { render } from '@testing-library/react-native';
import { Skeleton } from '../../../components/ui/Skeleton';

describe('Skeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<Skeleton />);
    expect(toJSON()).toBeTruthy();
  });

  it('applies custom width and height', () => {
    const { toJSON } = render(<Skeleton width={120} height={24} />);
    const json = toJSON() as any;
    const flatStyle = Array.isArray(json.props.style)
      ? Object.assign({}, ...json.props.style.filter(Boolean))
      : json.props.style;
    expect(flatStyle.width).toBe(120);
    expect(flatStyle.height).toBe(24);
  });

  it('applies custom borderRadius', () => {
    const { toJSON } = render(<Skeleton borderRadius={8} />);
    const json = toJSON() as any;
    const flatStyle = Array.isArray(json.props.style)
      ? Object.assign({}, ...json.props.style.filter(Boolean))
      : json.props.style;
    expect(flatStyle.borderRadius).toBe(8);
  });
});
