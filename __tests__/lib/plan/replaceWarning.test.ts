import { describeOutgoingWork } from '../../../lib/plan/replaceWarning';

const row = (over: Record<string, unknown> = {}) => ({
  is_checked: 0, item_key: 'name:x', ...over,
});

describe('describeOutgoingWork', () => {
  it('reports nothing for a plan with no active work', () => {
    expect(describeOutgoingWork([row(), row()])).toBeNull();
  });

  it('reports nothing for an empty plan', () => {
    expect(describeOutgoingWork([])).toBeNull();
  });

  it('counts checked items', () => {
    expect(describeOutgoingWork([row({ is_checked: 1 }), row()]))
      .toBe('1 item is checked off. It will be left behind with the old plan.');
  });

  it('pluralises checked items', () => {
    expect(describeOutgoingWork([row({ is_checked: 1 }), row({ is_checked: 1 })]))
      .toBe('2 items are checked off. They will be left behind with the old plan.');
  });

  it('counts hand-added rows — those are the ones no recipe can recreate', () => {
    expect(describeOutgoingWork([row({ item_key: null })]))
      .toBe('1 item was added by hand. It will be left behind with the old plan.');
  });

  it('combines both counts', () => {
    expect(describeOutgoingWork([
      row({ is_checked: 1 }), row({ is_checked: 1 }), row({ item_key: null }),
    ])).toBe(
      '2 items are checked off and 1 was added by hand. They will be left behind with the old plan.');
  });

  it('counts a row that is both checked and hand-added once in each tally', () => {
    expect(describeOutgoingWork([row({ is_checked: 1, item_key: null })]))
      .toBe('1 item is checked off and 1 was added by hand. They will be left behind with the old plan.');
  });
});
