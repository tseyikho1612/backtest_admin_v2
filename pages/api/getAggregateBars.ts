import { NextApiRequest, NextApiResponse } from 'next';
import { restClient } from '@polygon.io/client-js';

const polygonClient = restClient(process.env.POLYGON_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ticker, multiplier, timespan, from, to } = req.query;

  if (!ticker || !multiplier || !timespan || !from || !to) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const response = await polygonClient.stocks.aggregates(
      ticker as string,
      Number(multiplier),
      timespan as 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year',
      from as string,
      to as string
    );

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching aggregate bars:', error);
    res.status(500).json({ error: 'An error occurred while fetching data' });
  }
}