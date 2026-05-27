import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SuggestionDropdown } from '../../components/SuggestionDropdown';
import type { Suggestion } from '../../lib/suggestions/types';

const NOW = Date.parse('2026-05-27T12:00:00Z');

const PRODUCT_WITH_NUTRITION: Suggestion = {
  kind: 'product', brand: 'Vitasoy', productName: 'Oat Milk Barista',
  lastUsedAt: '2026-05-25T00:00:00Z', foodNutritionId: 'fn-1', matches: [],
};
const PRODUCT_NO_NUTRITION: Suggestion = {
  kind: 'product', brand: 'Vitasoy', productName: 'Calci-Plus Bar',
  lastUsedAt: '2026-05-25T00:00:00Z', foodNutritionId: null, matches: [],
};
const BRAND: Suggestion = {
  kind: 'brand', brand: 'Vitasoy', productName: null,
  productCount: 4, latestProductName: 'Oat Milk Barista',
  lastUsedAt: '2026-05-25T00:00:00Z', foodNutritionId: null, matches: [],
};

describe('SuggestionDropdown', () => {
  it('renders one row per suggestion', () => {
    const { getByText } = render(
      <SuggestionDropdown
        suggestions={[PRODUCT_WITH_NUTRITION, PRODUCT_NO_NUTRITION]}
        showBrandInSecondary={false}
        now={NOW}
        onPick={jest.fn()}
        onLayoutHeight={jest.fn()}
      />,
    );
    expect(getByText('Oat Milk Barista')).toBeTruthy();
    expect(getByText('Calci-Plus Bar')).toBeTruthy();
  });

  it('renders pie-chart emblem only on product rows with foodNutritionId', () => {
    const { queryAllByTestId } = render(
      <SuggestionDropdown
        suggestions={[PRODUCT_WITH_NUTRITION, PRODUCT_NO_NUTRITION, BRAND]}
        showBrandInSecondary={false}
        now={NOW}
        onPick={jest.fn()}
        onLayoutHeight={jest.fn()}
      />,
    );
    expect(queryAllByTestId('suggestion-emblem')).toHaveLength(1);
  });

  it('fires onPick with the suggestion when pressed', () => {
    const onPick = jest.fn();
    const { getByText } = render(
      <SuggestionDropdown
        suggestions={[PRODUCT_WITH_NUTRITION]}
        showBrandInSecondary={false}
        now={NOW}
        onPick={onPick}
        onLayoutHeight={jest.fn()}
      />,
    );
    fireEvent.press(getByText('Oat Milk Barista'));
    expect(onPick).toHaveBeenCalledWith(PRODUCT_WITH_NUTRITION);
  });

  it('shows brand in secondary line for product rows when showBrandInSecondary=true', () => {
    const { getByText } = render(
      <SuggestionDropdown
        suggestions={[PRODUCT_WITH_NUTRITION]}
        showBrandInSecondary={true}
        now={NOW}
        onPick={jest.fn()}
        onLayoutHeight={jest.fn()}
      />,
    );
    expect(getByText('Vitasoy')).toBeTruthy();
  });

  it('shows "{N} products · {latest} {relative}" secondary for brand rows', () => {
    const { getByText } = render(
      <SuggestionDropdown
        suggestions={[BRAND]}
        showBrandInSecondary={false}
        now={NOW}
        onPick={jest.fn()}
        onLayoutHeight={jest.fn()}
      />,
    );
    expect(getByText(/4 products · Oat Milk Barista/)).toBeTruthy();
  });
});
