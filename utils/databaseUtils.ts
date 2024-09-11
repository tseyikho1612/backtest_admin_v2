import { GapUpStockResult } from '../models/GapUpStockResult';

export async function checkResultsExist(fromDate: string, toDate: string): Promise<boolean> {
  const response = await fetch(`/api/checkResults?fromDate=${fromDate}&toDate=${toDate}`);
  const data = await response.json();
  return data.exists;
}

export async function saveResults(fromDate: string, toDate: string, results: GapUpStockResult[]): Promise<void> {
  await fetch('/api/saveResults', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fromDate, toDate, results }),
  });
}

export async function getResultsFromDatabase(fromDate: string, toDate: string): Promise<GapUpStockResult[]> {
  const response = await fetch(`/api/getResults?fromDate=${fromDate}&toDate=${toDate}`);
  const data = await response.json();
  return data.results;
}