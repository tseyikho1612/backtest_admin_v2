import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { format } from 'date-fns';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { dataSetName } = req.body;

  // Get the base URL from environment variables
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  try {
    // Fetch all records for the selected dataset
    const datasetRecords = await pool.query(
      'SELECT ticker, date FROM backtest_gapupshort a left join dataset b on a.datasetid = b.id WHERE b.datasetname = $1',
      [dataSetName]
    );

    if (datasetRecords.rows.length === 0) {
      return res.status(404).json({ message: `No records found for dataset: ${dataSetName}` });
    }

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const record of datasetRecords.rows) {
      const { ticker, date } = record;
      const formattedDate = format(new Date(date), 'yyyy-MM-dd');

      try {
        // Fetch intraday data for each record using the full URL
        const response = await fetch(`${baseUrl}/api/checkDeathCandleExist?ticker=${ticker}&date=${formattedDate}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const intradayData = await response.json();

        if (intradayData.deathCandlesExist) {
          // Save intraday data to the database
          for (const candle of intradayData.deathCandles) {
            await pool.query(
              `INSERT INTO intraday_data_oneMinuteBar (dataset_id, ticker, date, timestamp, time, open, close, high, low, open_to_close_percentage, high_to_close_percentage, prior_fifteen_minutes_change)
              VALUES ((SELECT id FROM dataset WHERE dataset_name = $1 AND ticker = $2 AND date = $3), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (dataset_id, ticker, date, timestamp) DO UPDATE SET
              time = EXCLUDED.time,
              open = EXCLUDED.open,
              close = EXCLUDED.close,
              high = EXCLUDED.high,
              low = EXCLUDED.low,
              open_to_close_percentage = EXCLUDED.open_to_close_percentage,
              high_to_close_percentage = EXCLUDED.high_to_close_percentage,
              prior_fifteen_minutes_change = EXCLUDED.prior_fifteen_minutes_change`,
              [dataSetName, ticker, date, candle.timestamp, candle.time, candle.open, candle.close, candle.high, candle.low, candle.openToClosePercentage, candle.highToClosePercentage, candle.priorFifteenMinutesChange]
            );
          }
          processedCount++;
        } else {
          errors.push(`No death candles found for ${ticker} on ${formattedDate}`);
          errorCount++;
        }
      } catch (error) {
        errors.push(`Error processing ${ticker} on ${formattedDate}: ${error instanceof Error ? error.message : String(error)}`);
        errorCount++;
      }
    }

    const totalRecords = datasetRecords.rows.length;
    const successCount = processedCount;

    let resultMessage = `Processed ${totalRecords} records. Success: ${successCount}, Errors: ${errorCount}`;
    
    if (errorCount > 0) {
      resultMessage += '\n\nError details:';
      const displayedErrors = errors.slice(0, 10);
      resultMessage += '\n' + displayedErrors.join('\n');
      if (errors.length > 10) {
        resultMessage += `\n... and ${errors.length - 10} more errors.`;
      }
    }

    return res.status(errorCount > 0 ? 207 : 200).json({ 
      message: resultMessage, 
      errors: errors,
      totalErrors: errors.length
    });

  } catch (error) {
    console.error('Error downloading intraday data:', error);
    return res.status(500).json({ message: `Error downloading intraday data: ${error instanceof Error ? error.message : String(error)}` });
  }
}