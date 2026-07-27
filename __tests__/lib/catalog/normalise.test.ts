import { normaliseItemName } from '../../../lib/catalog/normalise';

describe('normaliseItemName', () => {
  it('lowercases and trims', () => {
    expect(normaliseItemName('  Beef Mince  ')).toBe('beef mince');
  });

  it('drops parentheticals', () => {
    expect(normaliseItemName('Broccoli (for roast veg)')).toBe('broccoli');
  });

  it('takes only the text before the first comma', () => {
    expect(normaliseItemName('Baby cos lettuce, shredded')).toBe('baby cos lettuce');
  });

  it('strips punctuation and collapses whitespace', () => {
    expect(normaliseItemName('Beef chuck/gravy   beef')).toBe('beef chuck gravy beef');
  });

  it('handles a parenthetical before a comma', () => {
    expect(normaliseItemName('Chicken thigh fillets (boneless), diced'))
      .toBe('chicken thigh fillets');
  });

  it('returns an empty string for a name that is entirely punctuation', () => {
    expect(normaliseItemName('---')).toBe('');
  });

  it('collapses two recipe-specific names for the same item', () => {
    // The whole point: recipe names carry prep detail, shopping names carry
    // buying detail, and they have to meet somewhere.
    expect(normaliseItemName('Beef mince (lean)'))
      .toBe(normaliseItemName('Beef mince, browned'));
  });
});
