import { NextApiRequest, NextApiResponse } from 'next';
import { restClient } from '@polygon.io/client-js';
import { format, parse, subMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { isWithinTradingHours } from '../../utils/dateUtils';

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
  priorFifteenMinutesChange: number;
  volume: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ticker, date } = req.query;

  if (!ticker || !date || typeof ticker !== 'string' || typeof date !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid required parameters' });
  }

  try {
    console.log(`Received request for ticker: ${ticker}, date: ${date}`);

    const parsedDate = parse(date, 'yyyy-MM-dd', new Date());
    const formattedDate = format(parsedDate, 'yyyy-MM-dd');

    console.log(`Formatted date: ${formattedDate}`);
    console.log(`Fetching data from Polygon API...`);

    const response = await polygonClient.stocks.aggregates(ticker, 1, 'minute', formattedDate, formattedDate);

    console.log(`Received response from Polygon API`);

    if (!response.results || response.results.length === 0) {
      console.log(`No results found for the given date`);
      return res.status(404).json({ error: 'No data found for the given date' });
    }

    console.log(`Processing ${response.results.length} candles`);

    const deathCandles: DeathCandle[] = response.results.slice(15).reduce((acc: DeathCandle[], candle, index) => {
      if (!isValidCandle(candle)) return acc;

      const candleTime = new Date(candle.t);
      const priorCandle = response.results?.[index];

      if (!isValidCandle(priorCandle)) return acc;

      const openToClosePercentage = ((candle.c - candle.o) / candle.o) * 100;
      const highToClosePercentage = ((candle.c - candle.h) / candle.h) * 100;
      const priorFifteenMinutesChange = ((candle.o - priorCandle.o) / priorCandle.o) * 100;

      if (
        isWithinTradingHours(candleTime) &&
        openToClosePercentage < -5 &&
        highToClosePercentage < -7 &&
        candle.v > 50000 &&
        priorFifteenMinutesChange > 15
      ) {
        const hkTime = toZonedTime(candleTime, 'Asia/Hong_Kong');
        acc.push({
          timestamp: candle.t,
          time: format(hkTime, 'HH:mm:ss'),
          open: candle.o,
          close: candle.c,
          high: candle.h,
          low: candle.l,
          openToClosePercentage,
          highToClosePercentage,
          priorFifteenMinutesChange,
          volume: candle.v
        });
      }

      return acc;
    }, []);

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

function isValidCandle(candle: any): candle is { t: number; o: number; c: number; h: number; l: number; v: number } {
  return (
    candle &&
    typeof candle.t === 'number' &&
    typeof candle.o === 'number' &&
    typeof candle.c === 'number' &&
    typeof candle.h === 'number' &&
    typeof candle.l === 'number' &&
    typeof candle.v === 'number'
  );
}