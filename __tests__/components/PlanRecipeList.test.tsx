import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { PlanRecipeList, type PlanRecipeEntryView } from '../../components/PlanRecipeList';

const ENTRIES: PlanRecipeEntryView[] = [
  { recipeId: 'r1', title: 'Beef Ragu', recipeServings: 4, targetServes: 6 },
];

function renderList(props: Partial<React.ComponentProps<typeof PlanRecipeList>> = {}) {
  return render(
    <PlanRecipeList
      entries={ENTRIES}
      onSetServes={jest.fn()}
      onRemove={jest.fn()}
      onAdd={jest.fn()}
      onOpen={jest.fn()}
      {...props}
    />
  );
}

describe('PlanRecipeList', () => {
  it('labels the control "Make N serves", distinct from the recipe stepper', () => {
    // The recipe screen re-divides a fixed pot; this scales the pot. Opposite
    // behaviour, so they must not share a label.
    const { getByLabelText } = renderList();
    expect(getByLabelText('Make 6 serves of Beef Ragu')).toBeTruthy();
  });

  it('shows the scale factor against the recipe as written', () => {
    const { getByText } = renderList();
    expect(getByText('recipe serves 4 · ×1.5')).toBeTruthy();
  });

  it('shows the new value immediately but does not commit yet', () => {
    jest.useFakeTimers();
    const onSetServes = jest.fn();
    const { getByLabelText } = renderList({ onSetServes });
    fireEvent.press(getByLabelText('Increase serves for Beef Ragu'));
    expect(getByLabelText('Make 7 serves of Beef Ragu')).toBeTruthy();
    expect(onSetServes).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('commits once the taps settle', () => {
    jest.useFakeTimers();
    const onSetServes = jest.fn();
    const { getByLabelText } = renderList({ onSetServes });
    fireEvent.press(getByLabelText('Increase serves for Beef Ragu'));
    act(() => { jest.advanceTimersByTime(400); });
    expect(onSetServes).toHaveBeenCalledWith('r1', 7);
    jest.useRealTimers();
  });

  it('commits once for a burst of taps, not once per tap', () => {
    // Each commit is a full read-compute-diff-write cycle.
    jest.useFakeTimers();
    const onSetServes = jest.fn();
    const { getByLabelText } = renderList({ onSetServes });
    for (let i = 0; i < 5; i++) {
      fireEvent.press(getByLabelText(/Increase serves for Beef Ragu/));
    }
    act(() => { jest.advanceTimersByTime(400); });
    expect(onSetServes).toHaveBeenCalledTimes(1);
    expect(onSetServes).toHaveBeenCalledWith('r1', 11);
    jest.useRealTimers();
  });

  it('will not go below one serve', () => {
    jest.useFakeTimers();
    const onSetServes = jest.fn();
    const { getByLabelText } = renderList({
      entries: [{ ...ENTRIES[0], targetServes: 1 }], onSetServes,
    });
    fireEvent.press(getByLabelText('Decrease serves for Beef Ragu'));
    act(() => { jest.advanceTimersByTime(400); });
    expect(onSetServes).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('removes a recipe from the plan', () => {
    const onRemove = jest.fn();
    const { getByLabelText } = renderList({ onRemove });
    fireEvent.press(getByLabelText('Remove Beef Ragu from plan'));
    expect(onRemove).toHaveBeenCalledWith('r1');
  });

  it('offers to add a recipe', () => {
    const onAdd = jest.fn();
    const { getByLabelText } = renderList({ onAdd });
    fireEvent.press(getByLabelText('Add a recipe'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('flags a dangling row whose recipe was deleted, and still allows removing it', () => {
    const onRemove = jest.fn();
    const { getByText, getByLabelText, queryByLabelText } = renderList({
      entries: [{ recipeId: 'gone', title: 'Deleted Recipe', recipeServings: null, targetServes: 4 }],
      onRemove,
    });
    expect(getByText(/no longer exists/i)).toBeTruthy();
    expect(queryByLabelText(/Increase serves/)).toBeNull();
    fireEvent.press(getByLabelText('Remove Deleted Recipe from plan'));
    expect(onRemove).toHaveBeenCalledWith('gone');
  });

  it('renders nothing but the add button for an empty plan', () => {
    const { getByLabelText, queryByText } = renderList({ entries: [] });
    expect(getByLabelText('Add a recipe')).toBeTruthy();
    expect(queryByText('Beef Ragu')).toBeNull();
  });
});

describe('PlanRecipeList — opening the recipe', () => {
  it('taps through from the title', () => {
    const onOpen = jest.fn();
    const { getByLabelText } = renderList({ onOpen });
    fireEvent.press(getByLabelText('Open Beef Ragu'));
    expect(onOpen).toHaveBeenCalledWith('r1');
  });

  it('leaves the stepper independent of navigation', () => {
    jest.useFakeTimers();
    const onOpen = jest.fn();
    const { getByLabelText } = renderList({ onOpen });
    fireEvent.press(getByLabelText('Increase serves for Beef Ragu'));
    act(() => { jest.advanceTimersByTime(400); });
    expect(onOpen).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('leaves remove independent of navigation', () => {
    const onOpen = jest.fn();
    const onRemove = jest.fn();
    const { getByLabelText } = renderList({ onOpen, onRemove });
    fireEvent.press(getByLabelText('Remove Beef Ragu from plan'));
    expect(onRemove).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not offer to open a recipe that no longer exists', () => {
    const onOpen = jest.fn();
    const { queryByLabelText } = renderList({
      onOpen,
      entries: [{ recipeId: 'gone', title: 'Deleted Recipe', recipeServings: null, targetServes: 4 }],
    });
    expect(queryByLabelText('Open Deleted Recipe')).toBeNull();
  });
});
