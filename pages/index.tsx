import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getPreviousTradingDate } from '../utils/dateUtils';
import { setLastMonth, setLastWeek, setYesterday, sortResults, SortConfig } from '../utils/resultGrid';
import styles from '../styles/Home.module.css';
import { GapUpStockResult, columnNames } from '../models/GapUpStockResult';

const ITEMS_PER_PAGE = 20;

export default function Home() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState<GapUpStockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });
  const [currentPage, setCurrentPage] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentDate, setCurrentDate] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);

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
    setResults([]);
    setProgress(0);
    setCurrentDate('');

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/stockScanner?fromDate=${fromDate}&toDate=${toDate}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.progress !== undefined) {
        setProgress(data.progress);
        setCurrentDate(data.currentDate || '');
      } else if (data.finished) {
        if (data.results.length === 0) {
          setError("No data meet the criteria");
        } else {
          setResults(sortResults(data.results, sortConfig));
        }
        setLoading(false);
        eventSource.close();
      } else if (data.error) {
        setError(data.error);
        setLoading(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setError('An error occurred while fetching data');
      setLoading(false);
      eventSource.close();
    };
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

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

  useEffect(() => {
    // This effect will run whenever progress or currentDate changes
    // You can add any additional logic here if needed
  }, [progress, currentDate]);

  return (
    <div className={styles.container}>
      <Head>
        <title>Stock Gap Up Scanner</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <nav className={styles.navigation}>
        <Link href="/" className={styles.navButton}>
          Stock Gap Up Scanner
        </Link>
        {/* Add more navigation items here if needed */}
      </nav>

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

        {loading && (
          <div className={styles.loadingContainer}>
            <p>Loading... {progress.toFixed(2)}% complete</p>
            <p>Processing date: {currentDate}</p>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
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
                    <td className={styles.td}>{(stock.volume ?? 0).toLocaleString()}</td>
                    <td className={styles.td}>{(stock.float ?? 0).toLocaleString()}</td>
                    <td className={styles.td}>{(stock.marketCap ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.tableFooter}>
              <div className={styles.totalRecords}>
                Total Records: {results.length}
              </div>
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
          </div>
        )}
      </main>
    </div>
  );
}