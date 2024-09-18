import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT DISTINCT dataSetName FROM dataset ORDER BY dataSetName');
    client.release();

    const dataSetNames = result.rows.map(row => row.datasetname);
    res.status(200).json(dataSetNames);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Error fetching dataset names' });
  }
}