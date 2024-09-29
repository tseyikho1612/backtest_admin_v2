import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { dataSetName, strategyName } = req.body;

  try {
    const query = `
      SELECT r.*
      FROM backtest_v2_results r
      JOIN dataset d ON r.datasetId = d.id
      WHERE d.datasetname = $1 AND r.strategyName = $2
    `;

    const result = await pool.query(query, [dataSetName, strategyName]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No results found for the given dataset and strategy' });
    }

    res.status(200).json({ message: 'Backtest results retrieved successfully', results: result.rows });
  } catch (error) {
    console.error('Error selecting backtest results:', error);
    res.status(500).json({ message: `Error selecting backtest results: ${error instanceof Error ? error.message : String(error)}` });
  }
}