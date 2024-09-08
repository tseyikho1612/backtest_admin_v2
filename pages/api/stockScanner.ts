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

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    const results = [];
    let currentDate = new Date(fromDate as string);
    const endDate = new Date(toDate as string);
    const totalDays = Math.ceil((endDate.getTime() - currentDate.getTime()) / (1000 * 3600 * 24)) + 1;
    let processedDays = 0;

    while (currentDate <= endDate) {
      if (!isTradingDate(currentDate)) {
        currentDate.setDate(currentDate.getDate() + 1);
        processedDays++;
        continue;
      }

      const formattedDate = currentDate.toISOString().split('T')[0];
      const previousDate = getPreviousTradingDate(currentDate);
      const formattedPreviousDate = previousDate.toISOString().split('T')[0];

      const [currentDayData, previousDayData] = await Promise.all([
        polygonClient.stocks.aggregatesGroupedDaily(formattedDate, { adjusted: 'true' }),
        polygonClient.stocks.aggregatesGroupedDaily(formattedPreviousDate, { adjusted: 'true' }),
      ]);

      processedDays++;
      const progress = (processedDays / totalDays) * 100;
      res.write(`data: ${JSON.stringify({ progress, currentDate: formattedDate })}\n\n`);

      const gapUps = await calculateGapUps(currentDayData.results, previousDayData.results, formattedDate);
      results.push(...gapUps);

      // Add a small delay to allow the client to process the event
      await new Promise(resolve => setTimeout(resolve, 10));

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.write(`data: ${JSON.stringify({ finished: true, results })}\n\n`);
  } catch (error: unknown) {
    console.error('Error fetching stock data:', error);
    res.write(`data: ${JSON.stringify({ error: 'Error fetching stock data' })}\n\n`);
  } finally {
    res.end();
  }
}

async function calculateGapUps(currentDay: any[], previousDay: any[], currentDate: string): Promise<GapUpStockResult[]> {
  const gapUps: GapUpStockResult[] = [];

  for (const stock of currentDay) {
    if (stock.T.length > 4) continue;

    const prevDayStock = previousDay.find((s: any) => s.T === stock.T);
    if (prevDayStock) {
      const gapUpPercentage = ((stock.o - prevDayStock.c) / prevDayStock.c) * 100;
      if (gapUpPercentage > 70) {
        const spikePercentage = ((stock.h - stock.o) / stock.o) * 100;
        const o2cPercentage = ((stock.c - stock.o) / stock.o) * 100;

        // Fetch additional details

        var float: number | null = 0;
        var marketCap: number | null = 0;
        try {   
          const tickerDetails = await polygonClient.reference.tickerDetails(stock.T);
          float = tickerDetails.results?.weighted_shares_outstanding || null;
          marketCap = tickerDetails.results?.market_cap || null;
        } catch (error) {
          console.error('Error fetching ticker details:', error);
        }

        gapUps.push({
          ticker: stock.T,
          date: currentDate,
          gapUpPercentage: gapUpPercentage.toFixed(2),
          open: stock.o,
          close: stock.c,
          high: stock.h,
          low: stock.l,
          spikePercentage: spikePercentage.toFixed(2),
          o2cPercentage: o2cPercentage.toFixed(2),
          volume: stock.v,          
          float: float,
          marketCap: marketCap,
        });
      }
    }
  }

  return gapUps;
}