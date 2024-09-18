import { NextApiRequest, NextApiResponse } from 'next';
import { restClient } from '@polygon.io/client-js';
import { Pool } from 'pg';

const polygonClient = restClient(process.env.POLYGON_API_KEY || '');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fromDate, toDate } = req.query;

  if (!fromDate || !toDate) {
    return res.status(400).json({ error: 'From date and To date are required' });
  }

  try {
    // Fetch data from database
    const dbData = await fetchDatabaseData(fromDate as string, toDate as string);

    // Fetch and update data from Polygon.io API
    const updatedData = await fetchAndUpdatePolygonData(dbData);

    res.status(200).json(updatedData);
  } catch (error) {
    console.error('Error in tickerDetails debug API:', error);
    res.status(500).json({ error: 'An error occurred while fetching data' });
  }
}

async function fetchDatabaseData(fromDate: string, toDate: string) {
  const client = await pool.connect();
  try {
    const query = `
      SELECT DISTINCT ON (ticker, date) ticker, date
      FROM "GapUpShort"
      WHERE date BETWEEN $1 AND $2
      ORDER BY ticker, date
    `;
    const result = await client.query(query, [fromDate, toDate]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching data from database:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function fetchAndUpdatePolygonData(dbData: any[]) {
  const updatedData = [];

  for (const row of dbData) {
    try {
      const response = await polygonClient.reference.tickerDetails(row.ticker, { date: row.date });
      const results = response.results;

      updatedData.push({
        ticker: row.ticker,
        date: row.date,
        float: results?.weighted_shares_outstanding || null,
        market_cap: results?.market_cap || null,
      });
    } catch (error) {
      console.error(`Error fetching data from Polygon.io for ${row.ticker} on ${row.date}:`, error);
      updatedData.push({
        ticker: row.ticker,
        date: row.date,
        float: null,
        market_cap: null,
      });
    }
  }

  return updatedData;
}