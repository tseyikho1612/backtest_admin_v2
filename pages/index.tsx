import { useState, useEffect } from 'react';
import Head from 'next/head';
import { getPreviousTradingDate } from '../utils/dateUtils';
import { GapUpStockResult, columnNames } from '../models/GapUpStockResult';
import { sortResults, SortConfig, setLastMonth, setLastWeek, setYesterday } from '../utils/resultGrid';
import styles from '../styles/Home.module.css';

const ITEMS_PER_PAGE = 20;

export default function Home() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState<GapUpStockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });
  const [currentPage, setCurrentPage] = useState(1);

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

  const handleSetLastMonth = () => {
    const { fromDate, toDate } = setLastMonth();
    setFromDate(fromDate);
    setToDate(toDate);
  };

  const handleSetLastWeek = () => {
    const { fromDate, toDate } = setLastWeek();
    setFromDate(fromDate);
    setToDate(toDate);
  };

  const handleSetYesterday = () => {
    const { fromDate, toDate } = setYesterday();
    setFromDate(fromDate);
    setToDate(toDate);
  };

  const pageCount = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Stock Gap Up Scanner</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Stock <span className={styles.highlight}>G</span>ap <span className={styles.highlight}>U</span>p Scanner
        </h1>
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
          <div className={styles.shortcutButtons}>
            <button type="button" onClick={handleSetLastMonth} className={styles.shortcutButton}>
              Last Month
            </button>
            <button type="button" onClick={handleSetLastWeek} className={styles.shortcutButton}>
              Last Week
            </button>
            <button type="button" onClick={handleSetYesterday} className={styles.shortcutButton}>
              Yesterday
            </button>
          </div>
        </form>

        {loading && <p>Loading...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {results.length > 0 && (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {Object.keys(columnNames).map((key) => (
                    <th 
                      key={key} 
                      className={styles.th} 
                      onClick={() => key !== 'rowNumber' ? handleSort(key as keyof GapUpStockResult) : null}
                    >
                      {columnNames[key]}
                      {key !== 'rowNumber' && getSortIndicator(key as keyof GapUpStockResult)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((stock, index) => (
                  <tr key={index}>
                    <td className={styles.td}>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                    <td className={styles.td}>{stock.ticker}</td>
                    <td className={styles.td}>{stock.date}</td>
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
            {pageCount > 1 && (
              <div className={styles.pagination}>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`${styles.pageButton} ${currentPage === page ? styles.activePage : ''}`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}