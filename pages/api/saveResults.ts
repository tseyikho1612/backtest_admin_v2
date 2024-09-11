import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fromDate, toDate, results } = req.body;

  try {
    const client = await pool.connect();
    await client.query('BEGIN');

    for (const result of results) {
      await client.query(
        `INSERT INTO stock_results (
          date, ticker, gap_up_percentage, open, close, high, low, 
          spike_percentage, o2c_percentage, volume, float, market_cap
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (date, ticker) DO NOTHING`,
        [
          result.date,
          result.ticker,
          result.gapUpPercentage,
          result.open,
          result.close,
          result.high,
          result.low,
          result.spikePercentage,
          result.o2cPercentage,
          Math.round(result.volume || 0),
          Math.round(result.float || 0),
          Math.round(result.marketCap || 0)
        ]
      );
    }

    await client.query('COMMIT');
    client.release();

    res.status(200).json({ message: 'Results saved successfully' });
  } catch (error) {
    console.error('Error saving results:', error);
    res.status(500).json({ error: 'An error occurred while saving results' });
  }
}