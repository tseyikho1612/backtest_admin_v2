import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { isTradingDate } from '../../utils/dateUtils';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fromDate, toDate } = req.query;

  if (!fromDate || !toDate) {
    return res.status(400).json({ error: 'Missing date parameters' });
  }

  try {
    const client = await pool.connect();
    const results: { [date: string]: boolean } = {};
    
    let currentDate = new Date(fromDate as string);
    const endDate = new Date(toDate as string);

    while (currentDate <= endDate) {
      const formattedDate = currentDate.toISOString().split('T')[0];
      
      if (!isTradingDate(currentDate)) {
        results[formattedDate] = true;
      } else {
        const result = await client.query(
          'SELECT EXISTS(SELECT 1 FROM "GapUpShort" WHERE date = $1)',
          [formattedDate]
        );
        results[formattedDate] = result.rows[0].exists;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    client.release();

    res.status(200).json(results);
  } catch (error) {
    console.error('Error checking results:', error);
    res.status(500).json({ error: 'An error occurred while checking results' });
  }
}