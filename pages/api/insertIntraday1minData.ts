import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { parse, format } from 'date-fns';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false
});

function serverLog(message: string, data?: any) {
  const logMessage = `[INTRADAY_INSERT] ${message}`;
  if (data) {
    console.log(logMessage, JSON.stringify(data, null, 2));
  } else {
    console.log(logMessage);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  serverLog('Received request to insert intraday 1-minute data');

  if (req.method !== 'POST') {
    serverLog('Invalid method:', { method: req.method });
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { datasetName, ticker, date, candles } = req.body;
  serverLog('Received data:', { datasetName, ticker, date, candlesCount: candles?.length });

  if (!datasetName || !ticker || !date || !candles || !Array.isArray(candles)) {
    serverLog('Missing or invalid parameters');
    return res.status(400).json({ message: 'Missing or invalid required parameters' });
  }

  let client;
  try {
    client = await pool.connect();
    serverLog('Connected to database');

    await client.query('BEGIN');
    serverLog('Started transaction');

    // Get dataset_id based on datasetName
    const datasetQuery = 'SELECT id FROM dataset WHERE datasetname = $1';
    serverLog('Executing dataset query:', { query: datasetQuery });
    const datasetResult = await client.query(datasetQuery, [datasetName]);
    serverLog('Dataset query result:', { rows: datasetResult.rows });

    if (datasetResult.rows.length === 0) {
      throw new Error(`Dataset not found: ${datasetName}`);
    }

    const datasetId = datasetResult.rows[0].id;
    serverLog(`Dataset ID for ${datasetName}:`, { datasetId });

    const insertQuery = `
      INSERT INTO intraday_1min_data (dataset_id, ticker, date, time, open, high, low, close, volume)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const parsedDate = parse(date, 'yyyy-MM-dd', new Date());
    serverLog('Parsed date:', { parsedDate });

    for (const candle of candles) {
      try {
        // Parse the candle time and format it correctly for the database
        const candleDateTime = parse(candle.time, 'HH:mm:ss', parsedDate);
        const formattedTime = format(candleDateTime, 'HH:mm:ss');

        if (isNaN(candleDateTime.getTime())) {
          throw new Error(`Invalid time: ${candle.time}`);
        }
        serverLog('Inserting candle:', { ticker, date, time: formattedTime });
        await client.query(insertQuery, [
          datasetId,
          ticker,
          date,
          formattedTime,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume
        ]);
        serverLog('Candle inserted successfully');
      } catch (candleError) {
        serverLog('Error processing candle:', { candle, error: candleError });
        throw new Error(`Error inserting candle at time ${candle.time}: ${candleError instanceof Error ? candleError.message : String(candleError)}`);
      }
    }

    await client.query('COMMIT');
    serverLog('Transaction committed');
    res.status(200).json({ 
      message: 'Intraday 1-minute data inserted successfully', 
      datasetId, 
      datasetName 
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    serverLog('Error inserting intraday 1-minute data:', { error });
    res.status(500).json({ 
      message: `An error occurred while inserting intraday 1-minute data: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    if (client) client.release();
    serverLog('Database connection released');
  }
}