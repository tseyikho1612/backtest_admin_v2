import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import * as XLSX from 'xlsx';
import { getPreviousTradingDate } from '../utils/dateUtils';
import { setLastMonth, setLastWeek, setYesterday, sortResults, SortConfig } from '../utils/resultGrid';
import styles from '../styles/Home.module.css';
import { GapUpStockResult, columnNames } from '../models/GapUpStockResult';
import { checkResultsExist, saveResults, getResultsFromDatabase } from '../utils/databaseUtils';
import { isTradingDate } from '../utils/dateUtils';
import { GetStaticProps } from 'next';
import Navigation from '../components/Navigation';
import { useRouter } from 'next/router';

const ITEMS_PER_PAGE = 20;

export const getStaticProps: GetStaticProps = async () => {
  // Fetch any data you need for the home page
  return {
    props: {
      // Your props here
    },
  };
};

export default function DataCleaning() {
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
  const router = useRouter();

  const [dataSetNames, setDataSetNames] = useState<string[]>([]);
  const [selectedDataSet, setSelectedDataSet] = useState('');
  const [directSelect, setDirectSelect] = useState(false);

  useEffect(() => {
    const lastTradingDate = getPreviousTradingDate();
    const formattedDate = lastTradingDate.toISOString().split('T')[0];
    setFromDate(formattedDate);
    setToDate(formattedDate);
  }, []);

  useEffect(() => {
    fetchDataSetNames();
  }, []);

  const fetchDataSetNames = async () => {
    try {
      const response = await fetch('/api/getDataSetNames');
      const data = await response.json();
      setDataSetNames(data);
    } catch (error) {
      console.error('Error fetching dataset names:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setProgress(0);
    setCurrentDate('');
    setCurrentPage(1);

    try {
      if (directSelect) {
        // Directly select from the database
        const response = await fetch(`/api/getResults?fromDate=${fromDate}&toDate=${toDate}`);
        const { results: dbResults } = await response.json();
        if (dbResults.length === 0) {
          setError("No data meet the criteria");
        } else {
          const sortedResults = sortResults(dbResults, sortConfig);
          setResults(sortedResults);
        }
      } else {
        // Existing logic for fetching and processing data
        const response = await fetch(`/api/checkResults?fromDate=${fromDate}&toDate=${toDate}`);
        const dateExistence: { [date: string]: boolean } = await response.json();

        let allResults: GapUpStockResult[] = [];

        for (const [date, exists] of Object.entries(dateExistence)) {
          try {
            if (exists) {
              const dbResponse = await fetch(`/api/getResults?fromDate=${date}&toDate=${date}`);
              const { results: dbResults } = await dbResponse.json();
              allResults = [...allResults, ...dbResults];
            } else if (isTradingDate(new Date(date))) {
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
              }

              const eventSource = new EventSource(`/api/stockScanner?fromDate=${date}&toDate=${date}`);
              eventSourceRef.current = eventSource;

              await new Promise<void>((resolve) => {
                eventSource.onmessage = (event) => {
                  const data = JSON.parse(event.data);
                  if (data.progress !== undefined) {
                    setProgress(data.progress);
                    setCurrentDate(data.currentDate || '');
                  } else if (data.finished) {
                    if (Array.isArray(data.results)) {
                      allResults = [...allResults, ...data.results];
                    } else {
                      console.error(`Invalid results format for date ${date}:`, data.results);
                    }
                    eventSource.close();
                    resolve();
                  } else if (data.error) {
                    console.error(`Error processing date ${date}:`, data.error);
                    // Don't reject, just log the error and continue
                    eventSource.close();
                    resolve();
                  }
                };

                eventSource.onerror = (err) => {
                  console.error(`EventSource error for date ${date}:`, err);
                  // Don't reject, just log the error and continue
                  eventSource.close();
                  resolve();
                };
              });
            }
          } catch (error) {
            console.error(`Error processing date ${date}:`, error);
            // Continue to the next date even if there's an error
          }
        }

        if (allResults.length === 0) {
          setError("No data meet the criteria");
        } else {
          const sortedResults = sortResults(allResults, sortConfig);
          setResults(sortedResults);
          // Save results to the database
          try {
            await fetch('/api/saveResults', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fromDate, toDate, results: sortedResults }),
            });
          } catch (saveError) {
            console.error('Error saving results to database:', saveError);
            // Continue even if saving to database fails
          }
        }
      }
    } catch (error) {
      console.error('An error occurred while processing your request:', error);
      setError('An error occurred while processing your request. Some data may be incomplete.');
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

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
    
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const fileName = `${selectedStrategy}_results_${timestamp}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
  };

  const handleInsertToBackTest = async () => {
    const dataSetName = prompt('Enter a dataset name:', selectedDataSet);
    if (!dataSetName) return;

    const isExisting = dataSetNames.includes(dataSetName);
    if (isExisting) {
      const confirmOverwrite = confirm(`Dataset "${dataSetName}" already exists. Do you want to overwrite it?`);
      if (!confirmOverwrite) return;
    }
    try {
      const response = await fetch('/api/insertToBackTest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, dataSetName, strategyName: selectedStrategy }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchDataSetNames(); // Refresh the list of dataset names
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to insert data');
      }
    } catch (error) {
      console.error('Error inserting data:', error);
      alert(`Failed to insert data into backTest_GapUpShort table: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Backtest tool</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation 
        selectedStrategy={selectedStrategy}
        setSelectedStrategy={setSelectedStrategy}
      />

      <main className={styles.main}>
        <h1 className={styles.title}>Data Cleaning: {selectedStrategy}</h1>
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
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="directSelect"
              checked={directSelect}
              onChange={(e) => setDirectSelect(e.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="directSelect" className={styles.checkboxLabel}>
              Directly select from DB
            </label>
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

        <div className={styles.tableContainer}>
          <div className={styles.tableHeader}>
            <h2>Results</h2>
            <div className={styles.buttonContainer}>
              <button
                id="instToBackTestButton"
                onClick={handleInsertToBackTest}
                className={styles.insertButton}
                disabled={results.length === 0}
              >
                Insert to BackTesting
              </button>
              <button
                id="exportExcelButton"
                onClick={exportToExcel}
                className={styles.exportButton}
                disabled={results.length === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M2.859 2.877l12.57-1.795a.5.5 0 01.571.495v20.846a.5.5 0 01-.57.495L2.858 21.123a1 1 0 01-.859-.99V3.867a1 1 0 01.859-.99zM4 5.5v1h1v-1H4zm1 3v1h1v-1H5zm-1 3v1h1v-1H4zm1 3v1h1v-1H5zm-1 3v1h1v-1H4zm13.5-12v1h1v-1h-1zm1 3v1h1v-1h-1zm-1 3v1h1v-1h-1zm1 3v1h1v-1h-1zm-1 3v1h1v-1h-1z"/>
                </svg>
                Export to Excel
              </button>
            </div>
          </div>
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
          {results.length > 0 && (
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
          )}
        </div>
      </main>
    </div>
  );
}