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

export const columnNames: { [key in keyof GapUpStockResult]: string } = {
  ticker: 'Ticker',
  date: 'Date',
  gapUpPercentage: 'Gap Up %',
  open: 'Open',
  close: 'Close',
  high: 'High',
  low: 'Low',
  spikePercentage: 'Spike %',
  o2cPercentage: 'O2C %'
};