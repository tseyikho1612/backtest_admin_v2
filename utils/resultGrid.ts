import { GapUpStockResult } from '../models/GapUpStockResult';
import { getPreviousTradingDate } from './dateUtils';

export type SortConfig = {
  key: keyof GapUpStockResult;
  direction: 'ascending' | 'descending';
};

export function sortResults(results: GapUpStockResult[], sortConfig: SortConfig): GapUpStockResult[] {
  return [...results].sort((a, b) => {
    if (sortConfig.key === 'ticker') {
      return sortConfig.direction === 'ascending' 
        ? a[sortConfig.key].localeCompare(b[sortConfig.key])
        : b[sortConfig.key].localeCompare(a[sortConfig.key]);
    } else if (sortConfig.key === 'date') {
      return sortConfig.direction === 'ascending'
        ? new Date(a[sortConfig.key]).getTime() - new Date(b[sortConfig.key]).getTime()
        : new Date(b[sortConfig.key]).getTime() - new Date(a[sortConfig.key]).getTime();
    } else {
      return sortConfig.direction === 'ascending'
        ? Number(a[sortConfig.key]) - Number(b[sortConfig.key])
        : Number(b[sortConfig.key]) - Number(a[sortConfig.key]);
    }
  });
}

export function setLastMonth(): { fromDate: string; toDate: string } {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    fromDate: lastMonth.toISOString().split('T')[0],
    toDate: lastDayOfLastMonth.toISOString().split('T')[0]
  };
}

export function setLastWeek(): { fromDate: string; toDate: string } {
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    fromDate: lastWeek.toISOString().split('T')[0],
    toDate: today.toISOString().split('T')[0]
  };
}

export function setYesterday(): { fromDate: string; toDate: string } {
  const yesterday = getPreviousTradingDate();
  const formattedDate = yesterday.toISOString().split('T')[0];
  return {
    fromDate: formattedDate,
    toDate: formattedDate
  };
}