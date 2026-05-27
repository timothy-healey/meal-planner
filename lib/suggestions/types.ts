export type Candidate = {
  brand: string;
  productName: string | null;
  itemName: string | null;
  foodNutritionId: string | null;
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
  foodNutritionId: string | null;
  matches: { field: SuggestionKind; indices: [number, number][] }[];
};

export type QueryParams = {
  field: SuggestionKind;
  text: string;
  ingredientName: string;
  brandFilter?: string;
};
