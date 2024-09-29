import { format } from 'date-fns';

export interface BacktestData {
  ticker: string;
  date: string;
  open: number | string;
  close: number | string;
  high: number | string;
  low: number | string;
  // ... other fields
}

export interface DeathCandle {
  time: string;
  open: number;
  close: number;
  high: number;
  low: number;
  // ... other fields
}

export interface BacktestResult extends BacktestData {
  entryPrice?: number;
  exitPrice?: number;
  profit?: number | string; // Changed from just number to number | string
  stopLossTime?: string;
}

export async function runDeathCandleStrategy(data: BacktestData[]): Promise<BacktestResult[]> {
  const backtestResults: BacktestResult[] = [];

  for (const item of data) {
    const formattedDate = format(new Date(item.date), 'yyyy-MM-dd');
    const deathCandleResponse = await fetch(`/api/checkDeathCandleExist?ticker=${item.ticker}&date=${formattedDate}`);
    const deathCandleData = await deathCandleResponse.json();

    if (deathCandleData.deathCandlesExist) {
      const deathCandle = deathCandleData.deathCandles[0];
      const entryPrice = deathCandle.close;
      const stopLossPrice = deathCandle.high * 1.02;
      const exitPrice = Number(item.close);

      let profit: number;
      let stopLossTime: string | undefined;

      if (stopLossPrice < Number(item.high)) {
        // Stop loss triggered
        profit = ((entryPrice - stopLossPrice) / entryPrice) * 100;
        stopLossTime = deathCandle.time; // This is an approximation
      } else {
        // Exit at close
        profit = ((entryPrice - exitPrice) / entryPrice) * 100;
      }

      backtestResults.push({
        ...item,
        entryPrice,
        exitPrice,
        profit,
        stopLossTime
      });
    }
  }

  return backtestResults;
}