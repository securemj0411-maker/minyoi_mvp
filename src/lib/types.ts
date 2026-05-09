export type ListingCandidate = {
  pid: string;
  url: string;
  name: string;
  price: number;
  skuName: string;
  skuMedian: number;
  priceGap: number;
  numFaved: number;
  velocity: number;
  reviewRating: number | "";
  reviewCount: number;
  safety: number;
  riskHits: number;
  score: number;
  scoreFlags: string[];
  descriptionPreview: string;
  shippingFee: number;
  shippingFeeGeneral: number | null;
  shippingSource: string;
  estimatedBuyCost: number;
  grossResellGap: number;
  netGapAfterShipping: number;
};

export type CandidateBand = "고순익 후보" | "순익 후보" | "검토필요" | "제외" | "관찰";
export type CashoutHint = "빠름" | "보통" | "느림";
export type CandidateSignal = {
  label: string;
  source: "profit" | "demand" | "safety" | "description" | "shipping" | "rule";
};
