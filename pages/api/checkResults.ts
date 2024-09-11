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
      'SELECT EXISTS(SELECT 1 FROM stock_results WHERE date BETWEEN $1 AND $2)',
      [fromDate, toDate]
    );
    client.release();

    res.status(200).json({ exists: result.rows[0].exists });
  } catch (error) {
    console.error('Error checking results:', error);
    res.status(500).json({ error: 'An error occurred while checking results' });
  }
}