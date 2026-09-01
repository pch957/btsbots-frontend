export interface MarketPairState {
  baseAsset: string;
  quoteAsset: string;
  displayPair: string;   // e.g. "BTS_CNY"
  databasePair: string;  // e.g. "BTS_CNY" sorted alphabetically
}

export interface LimitOrderFormInput {
  buyPrice: string;
  buyAmount: string;
  sellPrice: string;
  sellAmount: string;
}