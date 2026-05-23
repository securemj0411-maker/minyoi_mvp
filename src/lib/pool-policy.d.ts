export const POOL_CONFIDENCE_FLOOR: number;
export const POOL_BLOCK_FLAGS: readonly string[];

export function bandFromProfit(profitMin: number, profitMax: number, category?: string | null): 1 | 2 | 3 | null;
export function poolMaxExposure(band: 1 | 2 | 3): number;
export function computePoolConfidence(
  parseConfidence: number | null | undefined,
  scoreFlags?: string[] | null,
): number;
export function hasPoolBlockFlag(scoreFlags?: string[] | null): boolean;
export function poolSkipReason(input: {
  profitMin: number;
  price: number;
  saleStatus?: string | null;
  skuMedian: number;
  riskHits: number;
  thumbnailUrl: string | null | undefined;
  categoryCanEnterPool: boolean;
  categoryReason?: string | null;
  comparableKey: string | null | undefined;
  needsReview: boolean;
  confidence: number;
  scoreFlags?: string[] | null;
}): string | null;
