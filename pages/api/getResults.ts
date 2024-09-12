import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fromDate, toDate } = req.query;

  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT 
        ticker, 
        date, 
        CAST(gap_up_percentage AS FLOAT) AS gap_up_percentage,
        CAST(open AS FLOAT) AS open,
        CAST(close AS FLOAT) AS close,
        CAST(high AS FLOAT) AS high,
        CAST(low AS FLOAT) AS low,
        CAST(spike_percentage AS FLOAT) AS spike_percentage,
        CAST(o2c_percentage AS FLOAT) AS o2c_percentage,
        CAST(volume AS BIGINT) AS volume,
        CAST(float AS BIGINT) AS float,
        CAST(market_cap AS BIGINT) AS market_cap
      FROM stock_results 
      WHERE date BETWEEN $1 AND $2 
      ORDER BY date, ticker`,
      [fromDate, toDate]
    );
    client.release();

    // Convert string numbers to actual numbers
    const processedResults = result.rows.map(row => ({
      ...row,
      gap_up_percentage: parseFloat(row.gap_up_percentage),
      spike_percentage: parseFloat(row.spike_percentage),
      o2c_percentage: parseFloat(row.o2c_percentage),
      open: parseFloat(row.open),
      close: parseFloat(row.close),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      volume: parseInt(row.volume),
      float: row.float ? parseInt(row.float) : null,
      market_cap: row.market_cap ? parseInt(row.market_cap) : null
    }));

    res.status(200).json({ results: processedResults });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'An error occurred while fetching results' });
  }
}