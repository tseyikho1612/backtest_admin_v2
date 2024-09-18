import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { results, dataSetName, strategyName } = req.body;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ message: 'Invalid or empty results array' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Always create or get the dataset ID
    let dataSetID;
    try {
      const dataSetCheckQuery = 'SELECT ID FROM dataSet WHERE dataSetName = $1';
      const dataSetCheckResult = await client.query(dataSetCheckQuery, [dataSetName]);
      if (dataSetCheckResult.rows.length > 0) {
        // Dataset exists, update it
        dataSetID = dataSetCheckResult.rows[0].id;
        // const updateDataSetQuery = 'UPDATE dataSet SET strategyName = $1 WHERE ID = $2 RETURNING ID';
        // const updateResult = await client.query(updateDataSetQuery, [strategyName, dataSetID]);
        // if (updateResult.rows.length === 0) {
        //   throw new Error('Failed to update existing dataset');
        // }
      } else {
        // Dataset doesn't exist, create a new one
        const insertDataSetQuery = 'INSERT INTO dataSet (dataSetName, strategyName) VALUES ($1, $2) RETURNING ID';
        const dataSetResult = await client.query(insertDataSetQuery, [dataSetName, strategyName]);
        
        if (dataSetResult.rows.length === 0) {
          throw new Error('Failed to create new dataset');
        }
        dataSetID = dataSetResult.rows[0].id;
        // res.status(500).json({ message: `Error inserting data: ${dataSetResult.rows[0].id}` });
      }

      if (dataSetID == null) {
        throw new Error('Failed to create or retrieve dataset ID');
      }
    } catch (datasetError) {
      console.error('Error handling dataset:', datasetError);
      throw datasetError;
    }
    // Delete existing records for this dataset
    await client.query('DELETE FROM backTest_GapUpShort WHERE dataSetID = $1', [dataSetID]);

    // Insert new records
    const insertQuery = `
      INSERT INTO backTest_GapUpShort (
        ticker, date, gap_up_percentage, open, close, high, low,
        spike_percentage, o2c_percentage, volume, float, market_cap, dataSetID
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    for (const result of results) {
      try {
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
          dataSetID,
        ]);
      } catch (insertError) {
        console.error('Error inserting row:', insertError);
        console.error('Problematic row:', result);
        throw insertError;
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Data inserted successfully', dataSetID });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error);
    res.status(500).json({ message: `Error inserting data: ${error instanceof Error ? error.message : String(error)}` });
  } finally {
    client.release();
  }
}