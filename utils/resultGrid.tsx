import { GapUpStockResult } from '../models/GapUpStockResult';

export type SortConfig = {
  key: keyof GapUpStockResult;
  direction: 'ascending' | 'descending';
};

export function sortResults(results: GapUpStockResult[], sortConfig: SortConfig): GapUpStockResult[] {
  return [...results].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    if (aValue == null || bValue == null) return 0;
    if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
    return 0;
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
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const formattedDate = yesterday.toISOString().split('T')[0];
  return {
    fromDate: formattedDate,
    toDate: formattedDate
  };
}