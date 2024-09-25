import { NextApiRequest, NextApiResponse } from 'next';
import { restClient } from '@polygon.io/client-js';
import { format, parse } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const polygonClient = restClient(process.env.POLYGON_API_KEY);

interface DeathCandle {
  timestamp: number;
  time: string;
  open: number;
  close: number;
  high: number;
  low: number;
  openToClosePercentage: number;
  highToClosePercentage: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ticker, date } = req.query;

  if (!ticker || !date) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    console.log(`Received request for ticker: ${ticker}, date: ${date}`);

    // Parse the input date (YYYY-MM-DD) and format it for the API
    const parsedDate = parse(date as string, 'yyyy-MM-dd', new Date());
    const formattedDate = format(parsedDate, 'yyyy-MM-dd');

    console.log(`Formatted date: ${formattedDate}`);

    // Fetch 3-minute aggregate bars for the given date
    console.log(`Fetching data from Polygon API...`);
    const response = await polygonClient.stocks.aggregates(
      ticker as string,
      1,
      'minute',
      formattedDate,
      formattedDate
    );

    console.log(`Received response from Polygon API`);

    if (!response.results) {
      console.log(`No results found for the given date`);
      return res.status(404).json({ error: 'No data found for the given date' });
    }

    console.log(`Processing ${response.results.length} candles`);

    const deathCandles: DeathCandle[] = response.results
      .filter((candle: any) => {
        const openToClosePercentage = ((candle.c - candle.o) / candle.o) * 100;
        const highToClosePercentage = ((candle.c - candle.h) / candle.h) * 100;

        return (
          (openToClosePercentage < -5) && // Long Red Candle
          (highToClosePercentage < -7) &&   // Long Wicked Red Candle
          (candle.v > 50000)
        );
      })
      .map((candle: any) => {
        const utcTime = new Date(candle.t);
        const hkTime = toZonedTime(utcTime, 'Asia/Hong_Kong');
        return {
          timestamp: candle.t,
          time: format(hkTime, 'HH:mm:ss'),
          open: candle.o,
          close: candle.c,
          high: candle.h,
          low: candle.l,
          openToClosePercentage: ((candle.c - candle.o) / candle.o) * 100,
          highToClosePercentage: ((candle.c - candle.h) / candle.h) * 100,
          volume: candle.v
        };
      });

    console.log(`Found ${deathCandles.length} death candles`);

    res.status(200).json({
      ticker,
      date: formattedDate,
      deathCandlesExist: deathCandles.length > 0,
      deathCandles,
    });
  } catch (error) {
    console.error('Error checking for death candles:', error);
    res.status(500).json({ 
      error: 'An error occurred while checking for death candles',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}