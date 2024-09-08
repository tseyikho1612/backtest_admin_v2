import { GapUpStockResult } from '../models/GapUpStockResult';

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