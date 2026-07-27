import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ServesSheet } from '../../components/ServesSheet';

function renderSheet(props: Partial<React.ComponentProps<typeof ServesSheet>> = {}) {
  return render(
    <ServesSheet
      visible={true}
      servings={3}
      caloriesPerServe={480}
      isApproximate={false}
      onSave={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />
  );
}

describe('ServesSheet', () => {
  it('renders the current serves count', () => {
    const { getByLabelText } = renderSheet();
    expect(getByLabelText('Serves 3')).toBeTruthy();
  });

  it('increments the count on +', () => {
    const { getByLabelText } = renderSheet();
    fireEvent.press(getByLabelText('Increase serves'));
    expect(getByLabelText('Serves 4')).toBeTruthy();
  });

  it('decrements the count on −', () => {
    const { getByLabelText } = renderSheet();
    fireEvent.press(getByLabelText('Decrease serves'));
    expect(getByLabelText('Serves 2')).toBeTruthy();
  });

  it('will not go below one serve', () => {
    const { getByLabelText } = renderSheet({ servings: 1 });
    fireEvent.press(getByLabelText('Decrease serves'));
    expect(getByLabelText('Serves 1')).toBeTruthy();
  });

  it('shows the per-serve calories for the current count', () => {
    const { getByText } = renderSheet();
    expect(getByText('480 kcal per serve')).toBeTruthy();
  });

  it('re-divides the fixed pot as the count changes', () => {
    const { getByLabelText, getByText } = renderSheet();
    // 3 × 480 = 1440 total; over 6 serves that is 240.
    fireEvent.press(getByLabelText('Increase serves'));
    fireEvent.press(getByLabelText('Increase serves'));
    fireEvent.press(getByLabelText('Increase serves'));
    expect(getByText('240 kcal per serve')).toBeTruthy();
  });

  it('marks the preview approximate when the rollup is partial', () => {
    const { getByText } = renderSheet({ isApproximate: true });
    expect(getByText('~480 kcal per serve')).toBeTruthy();
  });

  it('omits the preview when there are no calories to show', () => {
    const { queryByText } = renderSheet({ caloriesPerServe: null });
    expect(queryByText(/kcal per serve/)).toBeNull();
  });

  it('saves the chosen count on Done', () => {
    const onSave = jest.fn();
    const { getByLabelText, getByText } = renderSheet({ onSave });
    fireEvent.press(getByLabelText('Increase serves'));
    fireEvent.press(getByText('Done'));
    expect(onSave).toHaveBeenCalledWith(4);
  });

  it('does not save when dismissed without pressing Done', () => {
    const onSave = jest.fn();
    const { getByLabelText } = renderSheet({ onSave });
    fireEvent.press(getByLabelText('Increase serves'));
    fireEvent.press(getByLabelText('Close'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reseeds from the recipe when reopened after a dismissed edit', () => {
    const { getByLabelText, rerender } = renderSheet();
    fireEvent.press(getByLabelText('Increase serves'));
    expect(getByLabelText('Serves 4')).toBeTruthy();

    rerender(
      <ServesSheet
        visible={false}
        servings={3}
        caloriesPerServe={480}
        isApproximate={false}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    rerender(
      <ServesSheet
        visible={true}
        servings={3}
        caloriesPerServe={480}
        isApproximate={false}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByLabelText('Serves 3')).toBeTruthy();
  });
});
