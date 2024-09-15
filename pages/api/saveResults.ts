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
      try {
        await client.query(
          `INSERT INTO "GapUpShort" (
            date, ticker, gap_up_percentage, open, close, high, low, 
            spike_percentage, o2c_percentage, volume, float, market_cap
          ) VALUES (($1::date AT TIME ZONE 'Asia/Hong_Kong'), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (date, ticker) DO NOTHING`,
          [
            result.date,
            result.ticker,
            Number(result.gap_up_percentage) || 0,
            Number(result.open) || 0,
            Number(result.close) || 0,
            Number(result.high) || 0,
            Number(result.low) || 0,
            Number(result.spike_percentage) || 0,
            Number(result.o2c_percentage) || 0,
            Math.round(Number(result.volume) || 0),
            result.float !== null ? Math.round(Number(result.float)) : null,
            result.market_cap !== null ? Math.round(Number(result.market_cap)) : null
          ]
        );
      } catch (insertError) {
        console.error(`Error inserting row for ticker ${result.ticker}:`, insertError);
        console.error('Problematic data:', JSON.stringify(result, null, 2));
      }
    }

    await client.query('COMMIT');
    client.release();

    res.status(200).json({ message: 'Results saved successfully' });
  } catch (error: unknown) {
    console.error('Error saving results:', error);
    res.status(500).json({ error: `An error occurred while saving results: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
}