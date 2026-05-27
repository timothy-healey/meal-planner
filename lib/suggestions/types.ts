export type Candidate = {
  brand: string;
  productName: string;
  itemName: string;
  productId: string;
  hasNutrition: boolean;
  lastUsedAt: string;
};

export type SuggestionKind = 'brand' | 'product';

export type Suggestion = {
  kind: SuggestionKind;
  brand: string;
  productName: string | null;
  productCount?: number;
  latestProductName?: string | null;
  lastUsedAt: string;
  productId: string | null;
  hasNutrition: boolean;
  matches: { field: SuggestionKind; indices: [number, number][] }[];
};

export type QueryParams = {
  field: SuggestionKind;
  text: string;
  ingredientName: string;
  brandFilter?: string;
};
