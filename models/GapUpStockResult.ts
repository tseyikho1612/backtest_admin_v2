export interface GapUpStockResult {
  ticker: string;
  date: string;
  gap_up_percentage: number;
  open: number;
  close: number;
  high: number;
  low: number;
  spike_percentage: number;
  o2c_percentage: number;
  volume: number;
  float: number | null;
  market_cap: number | null;
}

export const columnNames: { [key: string]: string } = {
  rowNumber: '#',
  ticker: 'Ticker',
  date: 'Date',
  gap_up_percentage: 'Gap Up %',
  open: 'Open',
  close: 'Close',
  high: 'High',
  low: 'Low',
  spike_percentage: 'Spike %',
  o2c_percentage: 'O2C %',
  volume: 'Volume',
  float: 'Float',
  market_cap: 'Market Cap'
};