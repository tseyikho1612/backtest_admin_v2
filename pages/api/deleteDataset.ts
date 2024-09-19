import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Create a new pool using the connection string from your environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { datasetName } = req.body;

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // First, select the id by the dataset name
        const selectResult = await client.query('SELECT id FROM dataset WHERE datasetname = $1', [datasetName]);
        
        if (selectResult.rows.length === 0) {
          throw new Error(`Dataset "${datasetName}" not found`);
        }
        
        const datasetId = selectResult.rows[0].id;

        // Delete the dataset from the dataset table
        const deleteDatasetResult = await client.query('DELETE FROM dataset WHERE id = $1', [datasetId]);

        // Delete related records from backtest_gapUPshort table using the saved id
        const deleteBacktestResult = await client.query(
          'DELETE FROM backtest_gapUPshort WHERE datasetid = $1',
          [datasetId]
        );

        await client.query('COMMIT');
        res.status(200).json({ 
          message: 'Dataset and related records deleted successfully',
          deletedDatasetRecords: deleteDatasetResult.rowCount,
          deletedBacktestRecords: deleteBacktestResult.rowCount
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error deleting dataset:', error);
      res.status(500).json({ message: `Error deleting dataset: ${error instanceof Error ? error.message : String(error)}` });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}