import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { dataSetName, entryMethod, exitMethod, stopLossMethod } = req.body;

  try {
    const client = await pool.connect();
    const query = `
      SELECT b.* 
      FROM backTest_GapUpShort b
      JOIN dataset d ON b.datasetid = d.id
      WHERE d.dataSetName = $1
      ORDER BY b.date ASC
    `;
    const result = await client.query(query, [dataSetName]);
    client.release();

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Error fetching backtest data' });
  }
}