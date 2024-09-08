import { useState, useEffect } from 'react';
import Head from 'next/head';
import { getPreviousTradingDate } from '../utils/dateUtils';
import { GapUpStockResult } from '../models/GapUpStockResult';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState<GapUpStockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      const response = await fetch(`/api/stockScanner?fromDate=${fromDate}&toDate=${toDate}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'An error occurred while fetching data');
      }
      const data = await response.json();
      setResults(data);
    } catch (error: unknown) {
      console.error('Error fetching results:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    }

    setLoading(false);
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
                <th className={styles.th}>Ticker</th>
                <th className={styles.th}>Date</th>
                <th className={styles.th}>Gap Up %</th>
                <th className={styles.th}>Open</th>
                <th className={styles.th}>Close</th>
                <th className={styles.th}>High</th>
                <th className={styles.th}>Low</th>
                <th className={styles.th}>Spike %</th>
                <th className={styles.th}>O2C %</th>
              </tr>
            </thead>
            <tbody>
              {results.map((stock, index) => (
                <tr key={index}>
                  <td className={styles.td}>{stock.ticker}</td>
                  <td className={styles.td}>{new Date(stock.date).toLocaleDateString()}</td>
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