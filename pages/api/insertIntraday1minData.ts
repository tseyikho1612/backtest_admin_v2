import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { parse } from 'date-fns';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { datasetId, ticker, date, candles } = req.body;

  if (!datasetId || !ticker || !date || !candles || !Array.isArray(candles)) {
    return res.status(400).json({ message: 'Missing or invalid required parameters' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertQuery = `
      INSERT INTO intraday_1min_data (dataset_id, ticker, date, time, open, high, low, close, volume)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const parsedDate = parse(date, 'yyyy-MM-dd', new Date());

    for (const candle of candles) {
      const candleTime = parse(candle.time, 'HH:mm:ss', parsedDate);
      await client.query(insertQuery, [
        datasetId,
        ticker,
        date,
        candleTime,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume
      ]);
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Intraday 1-minute data inserted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inserting intraday 1-minute data:', error);
    res.status(500).json({ message: 'An error occurred while inserting intraday 1-minute data' });
  } finally {
    client.release();
  }
}