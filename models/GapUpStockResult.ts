export interface GapUpStockResult {
  ticker: string;
  date: string;
  gapUpPercentage: string;
  open: number;
  close: number;
  high: number;
  low: number;
  spikePercentage: string;
  o2cPercentage: string;
}