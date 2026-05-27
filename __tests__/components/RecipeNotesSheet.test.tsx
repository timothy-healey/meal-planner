import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecipeNotesSheet } from '../../components/RecipeNotesSheet';

describe('RecipeNotesSheet', () => {
  const baseProps = {
    visible: true,
    recipeTitle: 'Chicken Stir-fry',
    initialNotes: null as string | null,
    onSave: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onSave = jest.fn();
    baseProps.onClose = jest.fn();
  });

  it('returns null when not visible', () => {
    const { toJSON } = render(<RecipeNotesSheet {...baseProps} visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('renders the title using the provided recipe name', () => {
    const { getByText } = render(<RecipeNotesSheet {...baseProps} />);
    expect(getByText('Notes — Chicken Stir-fry')).toBeTruthy();
  });

  it('pre-fills the input with initialNotes when present', () => {
    const { getByDisplayValue } = render(
      <RecipeNotesSheet {...baseProps} initialNotes="sauce too thin" />,
    );
    expect(getByDisplayValue('sauce too thin')).toBeTruthy();
  });

  it('calls onSave with the trimmed text on Save', () => {
    const onSave = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <RecipeNotesSheet {...baseProps} onSave={onSave} />,
    );
    fireEvent.changeText(getByPlaceholderText(/What worked/i), '  doubled the broccoli  ');
    fireEvent.press(getByText('Save notes'));
    expect(onSave).toHaveBeenCalledWith('doubled the broccoli');
  });

  it('calls onSave(null) when text is empty or whitespace-only', () => {
    const onSave = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <RecipeNotesSheet {...baseProps} initialNotes="prev" onSave={onSave} />,
    );
    fireEvent.changeText(getByPlaceholderText(/What worked/i), '   ');
    fireEvent.press(getByText('Save notes'));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('calls onClose but not onSave when the close button is tapped', () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <RecipeNotesSheet {...baseProps} initialNotes="prev" onSave={onSave} onClose={onClose} />,
    );
    fireEvent.press(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
