import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { results } = req.body;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ message: 'Invalid or empty results array' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete existing records
    await client.query('DELETE FROM backTest_GapUpShort');

    // Insert new records
    const insertQuery = `
      INSERT INTO backTest_GapUpShort (
        ticker, date, gap_up_percentage, open, close, high, low,
        spike_percentage, o2c_percentage, volume, float, market_cap
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    for (const result of results) {
      await client.query(insertQuery, [
        result.ticker,
        result.date,
        result.gap_up_percentage,
        result.open,
        result.close,
        result.high,
        result.low,
        result.spike_percentage,
        result.o2c_percentage,
        result.volume,
        result.float,
        result.market_cap,
      ]);
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Data inserted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    res.status(500).json({ message: `Error inserting data: ${error.message}` });
  } finally {
    client.release();
  }
}