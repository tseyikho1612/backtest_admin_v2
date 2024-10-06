import { NextApiRequest, NextApiResponse } from 'next';
import { restClient } from '@polygon.io/client-js';
import { format, parse, addMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { isWithinTradingHours, getTradingHours } from '../../utils/dateUtils';

const polygonClient = restClient(process.env.POLYGON_API_KEY);

interface DeathCandle {
  time: string;
  open: number;
  close: number;
  high: number;
  low: number;
  openToClosePercentage: number;
  volume: number;
  previousTwoCandlesChange: number;
  isDeathCandle: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ticker, date, debug } = req.query;

  if (!ticker || !date || typeof ticker !== 'string' || typeof date !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid required parameters' });
  }

  const isDebug = debug === 'true';

  try {
    console.log(`Received request for ticker: ${ticker}, date: ${date}, debug: ${isDebug}`);

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

    const { start: marketOpenTime, end: marketCloseTime } = getTradingHours(parsedDate);

    const processedCandles: DeathCandle[] = response.results.reduce((acc: DeathCandle[], candle, index) => {
      if (!isValidCandle(candle)) return acc;

      const candleTime = new Date(candle.t);
      
      if (!isWithinTradingHours(candleTime)) return acc;

      const openToClosePercentage = ((candle.c - candle.o) / candle.o) * 100;
      let previousTwoCandlesChange = 0;
      let previousTwoCandlesMiddlePrice = 0;
      let isDeathCandle = false;

      // 10 minutes after market open
      // previous two candles change > 0
      // current candle drop half of the previous two candles change
      if (candleTime >= addMinutes(marketOpenTime, 10) && index >= 2) {
        const prevCandle1 = response.results?.[index - 1];
        const prevCandle2 = response.results?.[index - 2];

        if (isValidCandle(prevCandle1) && isValidCandle(prevCandle2)) {
          previousTwoCandlesChange = ((prevCandle1.c - prevCandle2.o) / prevCandle2.o) * 100;
          previousTwoCandlesMiddlePrice = (prevCandle2.l + prevCandle1.h) / 2;
          const currentCandleChange = ((candle.c - prevCandle1.c) / prevCandle1.c) * 100;

          isDeathCandle = candle.c < candle.o && 
                          openToClosePercentage < -5 && 
                          previousTwoCandlesChange > 0 &&                           
                          previousTwoCandlesMiddlePrice >= candle.l ;
        }
      } else {
        // Red Candle and (open to close percentage < -5)
        isDeathCandle = candle.c < candle.o && openToClosePercentage < -5;
      }

      const hkTime = toZonedTime(candleTime, 'Asia/Hong_Kong');
      acc.push({
        time: format(hkTime, 'HH:mm:ss'),
        open: candle.o,
        close: candle.c,
        high: candle.h,
        low: candle.l,
        openToClosePercentage,
        volume: candle.v,
        previousTwoCandlesChange,
        isDeathCandle
      });

      return acc;
    }, []);

    const deathCandles = processedCandles.filter(candle => candle.isDeathCandle);

    // Modify this part to process post-entry candles
    const deathCandlesWithPostEntryData = deathCandles.map(deathCandle => {
      const deathCandleIndex = processedCandles.findIndex(c => c.time === deathCandle.time);
      const postEntryCandles = processedCandles.slice(deathCandleIndex + 1);
      const stopLossPrice = deathCandle.high * 1.02;
      const stopLossTriggered = postEntryCandles.some(candle => {
        const candleDateTime = new Date(`${formattedDate}T${candle.time}`);
        return isWithinTradingHours(candleDateTime) && candle.high > stopLossPrice;
      });
      const stopLossTime = stopLossTriggered 
        ? postEntryCandles.find(candle => candle.high > stopLossPrice)?.time 
        : undefined;

      return {
        ...deathCandle,
        stopLossPrice,
        stopLossTriggered,
        stopLossTime,
      };
    });

    console.log(`Found ${deathCandles.length} death candles`);

    if (isDebug) {
      res.status(200).json({
        ticker,
        date: formattedDate,
        deathCandlesExist: deathCandles.length > 0,
        allCandles: processedCandles,
        deathCandles: deathCandlesWithPostEntryData,
      });
    } else {
      res.status(200).json({
        ticker,
        date: formattedDate,
        deathCandlesExist: deathCandles.length > 0,
        deathCandles: deathCandlesWithPostEntryData,
      });
    }
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