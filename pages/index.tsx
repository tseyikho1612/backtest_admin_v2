import { useState, useEffect } from 'react';
import Head from 'next/head';
import { getPreviousTradingDate } from '../utils/dateUtils';
import { GapUpStockResult, columnNames } from '../models/GapUpStockResult';
import { sortResults, SortConfig } from '../utils/resultGrid';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState<GapUpStockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });

  useEffect(() => {
    const lastTradingDate = getPreviousTradingDate();
    const formattedDate = lastTradingDate.toISOString().split('T')[0];
    setFromDate(formattedDate);
    setToDate(formattedDate);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]); // 清除現有結果

    try {
      const response = await fetch(`/api/stockScanner?fromDate=${fromDate}&toDate=${toDate}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'An error occurred while fetching data');
      }
      const data = await response.json();
      const sortedData = sortResults(data, sortConfig);
      setResults(sortedData);
    } catch (error: unknown) {
      console.error('Error fetching results:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    }

    setLoading(false);
  };

  const handleSort = (key: keyof GapUpStockResult) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    const newSortConfig: SortConfig = { key, direction };
    setSortConfig(newSortConfig);
    const sortedResults = sortResults(results, newSortConfig);
    setResults(sortedResults);
  };

  const getSortIndicator = (key: keyof GapUpStockResult) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    }
    return '';
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Stock Gap Up Scanner</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>Stock Gap Up Scanner</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={styles.input}
              required
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={styles.input}
              required
            />
            <button type="submit" className={styles.button}>
              Search
            </button>
          </div>
        </form>

        {loading && <p>Loading...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {results.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                {Object.keys(columnNames).map((key) => (
                  <th 
                    key={key} 
                    className={styles.th} 
                    onClick={() => handleSort(key as keyof GapUpStockResult)}
                    style={{ cursor: 'pointer' }}
                  >
                    {columnNames[key as keyof GapUpStockResult]}
                    {getSortIndicator(key as keyof GapUpStockResult)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((stock, index) => (
                <tr key={index}>
                  <td className={styles.td}>{stock.ticker}</td>
                  <td className={styles.td}>{stock.date}</td> {/* 直接使用 stock.date，不進行轉換 */}
                  <td className={styles.td}>{stock.gapUpPercentage}%</td>
                  <td className={styles.td}>{stock.open.toFixed(2)}</td>
                  <td className={styles.td}>{stock.close.toFixed(2)}</td>
                  <td className={styles.td}>{stock.high.toFixed(2)}</td>
                  <td className={styles.td}>{stock.low.toFixed(2)}</td>
                  <td className={styles.td}>{stock.spikePercentage}%</td>
                  <td className={styles.td}>{stock.o2cPercentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}