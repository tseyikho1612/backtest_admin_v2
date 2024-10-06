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
  stopLossPrice: number;
  stopLossTriggered: boolean;
  stopLossTime?: string;
  // ... other fields
}

export interface BacktestResult extends BacktestData {
  entryprice?: number;
  exitprice?: number;
  profit?: number;
  stopLossTime?: string;
  entryTime?: string;
  entrytime?: string;
  gap_up_percentage?: number;
  spike_percentage?: number;
  o2c_percentage?: number;
  volume?: number;
  float?: number;
  market_cap?: number;
}

export async function runDeathCandleStrategy(data: BacktestData[]): Promise<BacktestResult[]> {
  const backtestResults: BacktestResult[] = [];

  for (const item of data) {
    const formattedDate = format(new Date(item.date), 'yyyy-MM-dd');
    const deathCandleResponse = await fetch(`/api/checkDeathCandleExist?ticker=${item.ticker}&date=${formattedDate}`);
    const deathCandleData = await deathCandleResponse.json();

    if (deathCandleData.deathCandlesExist) {
      const deathCandle = deathCandleData.deathCandles[0];
      if (deathCandle.open < 1) {
        continue;
      }
      const entryPrice = deathCandle.close;
      let exitPrice = Number(item.close);

      let profit: number;
      let stopLossTime: string | undefined;

      if (deathCandle.stopLossTriggered) {
        // Stop loss triggered
        profit = ((entryPrice - deathCandle.stopLossPrice) / entryPrice) * 100;
        exitPrice = deathCandle.stopLossPrice;
        stopLossTime = deathCandle.stopLossTime;
      } else {
        // Exit at close
        profit = ((entryPrice - exitPrice) / entryPrice) * 100;
      }

      backtestResults.push({
        ...item,
        entryprice: entryPrice,
        exitprice: exitPrice,
        profit,
        stopLossTime,
        entryTime: deathCandle.time,
      });
    }
  }

  return backtestResults;
}