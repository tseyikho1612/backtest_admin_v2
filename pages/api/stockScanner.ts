import { restClient } from '@polygon.io/client-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import { GapUpStockResult } from '../../models/GapUpStockResult';

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
      const formattedDate = currentDate.toISOString().split('T')[0];
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const formattedPreviousDate = previousDate.toISOString().split('T')[0];

      console.log(`Fetching data for ${formattedDate} and ${formattedPreviousDate}`);
      const [currentDayData, previousDayData] = await Promise.all([
        polygonClient.stocks.aggregatesGroupedDaily(formattedDate, { adjusted: true }),
        polygonClient.stocks.aggregatesGroupedDaily(formattedPreviousDate, { adjusted: true }),
      ]);

      console.log(`Calculating gap ups for ${formattedDate}`);
      const gapUps = calculateGapUps(currentDayData.results, previousDayData.results);
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

function calculateGapUps(currentDay: any[], previousDay: any[]): GapUpStockResult[] {
  const gapUps: GapUpStockResult[] = [];

  for (const stock of currentDay) {
    const prevDayStock = previousDay.find((s: any) => s.T === stock.T);
    if (prevDayStock) {
      const gapUpPercentage = ((stock.o - prevDayStock.c) / prevDayStock.c) * 100;
      if (gapUpPercentage > 70) {
        const spikePercentage = ((stock.h - stock.o) / stock.o) * 100;
        const o2cPercentage = ((stock.c - stock.o) / stock.o) * 100;

        gapUps.push({
          ticker: stock.T,
          date: stock.t,
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