import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getPreviousTradingDate } from '../utils/dateUtils';
import { setLastMonth, setLastWeek, setYesterday, sortResults, SortConfig } from '../utils/resultGrid';
import styles from '../styles/Home.module.css';
import { GapUpStockResult, columnNames } from '../models/GapUpStockResult';
import { checkResultsExist, saveResults, getResultsFromDatabase } from '../utils/databaseUtils';
import { isTradingDate } from '../utils/dateUtils';
import { GetStaticProps } from 'next';

const ITEMS_PER_PAGE = 20;

export const getStaticProps: GetStaticProps = async () => {
  // Fetch any data you need for the home page
  return {
    props: {
      // Your props here
    },
  };
};

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
  
  const [selectedStrategy, setSelectedStrategy] = useState('Gap Up Short');

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
    setCurrentPage(1); // Reset to page 1

    try {
      // Check if results exist in the database
      const response = await fetch(`/api/checkResults?fromDate=${fromDate}&toDate=${toDate}`);
      const dateExistence: { [date: string]: boolean } = await response.json();

      let allResults: GapUpStockResult[] = [];

      for (const [date, exists] of Object.entries(dateExistence)) {
        if (exists) {
          // Fetch results from the database for this date
          const dbResponse = await fetch(`/api/getResults?fromDate=${date}&toDate=${date}`);
          const { results: dbResults } = await dbResponse.json();
          allResults = [...allResults, ...dbResults];
        } else if (isTradingDate(new Date(date))) {
          // Fetch results from API for this date
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
          }

          const eventSource = new EventSource(`/api/stockScanner?fromDate=${date}&toDate=${date}`);
          eventSourceRef.current = eventSource;

          await new Promise((resolve, reject) => {
            eventSource.onmessage = async (event) => {
              const data = JSON.parse(event.data);
              if (data.progress !== undefined) {
                setProgress(data.progress);
                setCurrentDate(data.currentDate || '');
              } else if (data.finished) {
                allResults = [...allResults, ...data.results];
                eventSource.close();
                resolve(null);
              } else if (data.error) {
                console.error('Error from server:', data.error);
                setError(`Error: ${data.error}`);
                eventSource.close();
                reject(new Error(data.error));
              }
            };

            eventSource.onerror = (err) => {
              console.error('EventSource error:', err);
              reject(new Error('An error occurred while fetching data. Please try again.'));
            };
          });
        }
      }

      if (allResults.length === 0) {
        setError("No data meet the criteria");
      } else {
        const sortedResults = sortResults(allResults, sortConfig);
        setResults(sortedResults);
        // Save results to the database
        await fetch('/api/saveResults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromDate, toDate, results: sortedResults }),
        });
      }
    } catch (error) {
      setError('An error occurred while processing your request');
      console.error(error);
    } finally {
      setLoading(false);
    }
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
        <title>Backtest tool</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <nav className={styles.navigation}>
        <div className={styles.navLeft}>
          <select 
            value={selectedStrategy} 
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className={styles.selectedStrategy}
          >
            <option value="Gap Up Short">Gap Up Short</option>
            {/* Add more options here as needed */}
          </select>
          <Link href="/" className={styles.navButton}>
            Data Cleaning
          </Link>
        </div>
        {/* Add more navigation items here if needed */}
      </nav>

      <main className={styles.main}>
        <h1 className={styles.title}>
          {selectedStrategy}
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
                    <td className={styles.td}>{new Date(stock.date).toISOString().split('T')[0]}</td>
                    <td className={styles.td}>{stock.gap_up_percentage.toFixed(2)}%</td>
                    <td className={styles.td}>{stock.open.toFixed(2)}</td>
                    <td className={styles.td}>{stock.close.toFixed(2)}</td>
                    <td className={styles.td}>{stock.high.toFixed(2)}</td>
                    <td className={styles.td}>{stock.low.toFixed(2)}</td>
                    <td className={styles.td}>{stock.spike_percentage.toFixed(2)}%</td>
                    <td className={styles.td}>{stock.o2c_percentage.toFixed(2)}%</td>
                    <td className={styles.td}>{stock.volume.toLocaleString()}</td>
                    <td className={styles.td}>{stock.float ? stock.float.toLocaleString() : 'N/A'}</td>
                    <td className={styles.td}>{stock.market_cap ? stock.market_cap.toLocaleString() : 'N/A'}</td>
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