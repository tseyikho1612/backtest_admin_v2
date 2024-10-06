import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function convertToNumeric(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : Number(num.toFixed(2));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { dataSetName, strategyName, results } = req.body;

  try {
    // Get the datasetId
    const datasetQuery = await pool.query(
      'SELECT id FROM dataset WHERE datasetname = $1',
      [dataSetName]
    );

    if (datasetQuery.rows.length === 0) {
      return res.status(404).json({ message: `Dataset not found: ${dataSetName}` });
    }

    const datasetId = datasetQuery.rows[0].id;

    // Begin transaction
    await pool.query('BEGIN');

    let insertedCount = 0;

    for (const result of results) {
      await pool.query(
        `INSERT INTO backtest_v2_results (
          datasetId, strategyName, ticker, date, open, close, high, low,
          gap_up_percentage, spike_percentage, o2c_percentage, volume, float, market_cap,
          entryPrice, exitPrice, profit, stopLossTime, entrytime
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          datasetId, strategyName, result.ticker, result.date,
          convertToNumeric(result.open), convertToNumeric(result.close), 
          convertToNumeric(result.high), convertToNumeric(result.low),
          convertToNumeric(result.gap_up_percentage), convertToNumeric(result.spike_percentage), 
          convertToNumeric(result.o2c_percentage),
          convertToNumeric(result.volume), convertToNumeric(result.float), convertToNumeric(result.market_cap),
          convertToNumeric(result.entryprice), convertToNumeric(result.exitprice), 
          convertToNumeric(result.profit), result.stopLossTime,
          result.entryTime // Add this line to include entrytime
        ]
      );
      insertedCount++;
    }

    // Commit transaction
    await pool.query('COMMIT');

    res.status(200).json({ message: 'Backtest results inserted successfully', insertedCount });
  } catch (error) {
    // Rollback transaction in case of error
    await pool.query('ROLLBACK');
    console.error('Error inserting backtest results:', error);
    res.status(500).json({ message: `Error inserting backtest results: ${error instanceof Error ? error.message : String(error)}` });
  }
}