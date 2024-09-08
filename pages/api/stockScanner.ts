import { restClient } from '@polygon.io/client-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import { GapUpStockResult } from '../../models/GapUpStockResult';
import { isTradingDate, getPreviousTradingDate } from '../../utils/dateUtils';

const polygonClient = restClient(process.env.POLYGON_API_KEY || '');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fromDate, toDate } = req.query;

  if (!fromDate || !toDate) {
    return res.status(400).json({ error: 'Missing date parameters' });
  }

  try {
    console.log(`Fetching data from ${fromDate} to ${toDate}`);
    const results = [];
    let currentDate = new Date(fromDate as string);
    const endDate = new Date(toDate as string);

    while (currentDate <= endDate) {
      if (!isTradingDate(currentDate)) {
        console.log(`Skipping non-trading date: ${currentDate.toISOString().split('T')[0]}`);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const formattedDate = currentDate.toISOString().split('T')[0];
      const previousDate = getPreviousTradingDate(currentDate);
      const formattedPreviousDate = previousDate.toISOString().split('T')[0];

      console.log(`Fetching data for ${formattedDate} and ${formattedPreviousDate}`);
      const [currentDayData, previousDayData] = await Promise.all([
        polygonClient.stocks.aggregatesGroupedDaily(formattedDate, { adjusted: 'true' }),
        polygonClient.stocks.aggregatesGroupedDaily(formattedPreviousDate, { adjusted: 'true' }),
      ]);

      console.log(`Calculating gap ups for ${formattedDate}`);
      const gapUps = calculateGapUps(currentDayData.results, previousDayData.results, formattedDate);
      results.push(...gapUps);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`Returning ${results.length} results`);
    res.status(200).json(results);
  } catch (error: unknown) {
    console.error('Error fetching stock data:', error);
    res.status(500).json({ error: 'Error fetching stock data', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}

function calculateGapUps(currentDay: any[], previousDay: any[], currentDate: string): GapUpStockResult[] {
  const gapUps: GapUpStockResult[] = [];

  for (const stock of currentDay) {
    // 跳過超過 4 個字母的股票代碼
    if (stock.T.length > 4) continue;

    const prevDayStock = previousDay.find((s: any) => s.T === stock.T);
    if (prevDayStock) {
      const gapUpPercentage = ((stock.o - prevDayStock.c) / prevDayStock.c) * 100;
      if (gapUpPercentage > 70) {
        const spikePercentage = ((stock.h - stock.o) / stock.o) * 100;
        const o2cPercentage = ((stock.c - stock.o) / stock.o) * 100;

        gapUps.push({
          ticker: stock.T,
          date: currentDate, // 使用傳入的日期，而不是 stock.t
          gapUpPercentage: gapUpPercentage.toFixed(2),
          open: stock.o,
          close: stock.c,
          high: stock.h,
          low: stock.l,
          spikePercentage: spikePercentage.toFixed(2),
          o2cPercentage: o2cPercentage.toFixed(2),
        });
      }
    }
  }

  return gapUps;
}