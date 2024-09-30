import { NextApiRequest, NextApiResponse } from 'next';
import { restClient } from '@polygon.io/client-js';
import { format, parse } from 'date-fns';

const polygonClient = restClient(process.env.POLYGON_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ticker, date } = req.query;

  if (!ticker || !date || typeof ticker !== 'string' || typeof date !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid required parameters' });
  }

  try {
    const parsedDate = parse(date, 'yyyy-MM-dd', new Date());
    const formattedDate = format(parsedDate, 'yyyy-MM-dd');

    const response = await polygonClient.stocks.aggregates(ticker, 1, 'minute', formattedDate, formattedDate);

    if (!response.results || response.results.length === 0) {
      return res.status(404).json({ error: 'No data found for the given date' });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching intraday data:', error);
    res.status(500).json({ 
      error: 'An error occurred while fetching intraday data',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}