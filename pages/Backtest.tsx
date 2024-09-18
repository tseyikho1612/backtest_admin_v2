import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import Navigation from '../components/Navigation';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { ChartData } from 'chart.js';
import { format } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface BacktestData {
  ticker: string;
  date: string;
  gap_up_percentage: number | string;
  open: number | string;
  close: number | string;
  high: number | string;
  low: number | string;
  spike_percentage: number | string;
  o2c_percentage: number | string;
  volume: number | string;
  float: number | string | null;
  market_cap: number | string | null;
  profit: number;
}

export default function Backtest() {
  const [selectedStrategy, setSelectedStrategy] = useState('Gap Up Short');
  const [entryMethod, setEntryMethod] = useState('at open');
  const [exitMethod, setExitMethod] = useState('at close');
  const [stopLossMethod, setStopLossMethod] = useState('30% higher than open');
  const [chartData, setChartData] = useState<ChartData<'line'>>({ labels: [], datasets: [] });
  const [backtestData, setBacktestData] = useState<BacktestData[]>([]);

  useEffect(() => {
    fetchBacktestData();
  }, [entryMethod, exitMethod, stopLossMethod]);

  const fetchBacktestData = async () => {
    try {
      const response = await fetch('/api/getBacktestData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryMethod, exitMethod, stopLossMethod }),
      });
      const data = await response.json();
      
      if (data && data.length > 0) {
        const sortedData = data.sort((a: BacktestData, b: BacktestData) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const labels = sortedData.map((item: BacktestData) => format(new Date(item.date), 'dd-MM-yy'));
        const profits = calculateAccumulativeProfits(sortedData);
        
        setChartData({
          labels,
          datasets: [
            {
              label: 'Accumulative Profit',
              data: profits,
              borderColor: 'rgb(75, 192, 192)',
              tension: 0.1,
            },
          ],
        });

        setBacktestData(sortedData);
      }
    } catch (error) {
      console.error('Error fetching backtest data:', error);
    }
  };

  const calculateAccumulativeProfits = (data: BacktestData[]) => {
    let accumulativeProfit = 0;
    return data.map(item => {
      const profit = calculateProfit(item);
      accumulativeProfit += profit;
      return accumulativeProfit;
    });
  };

  const calculateProfit = (item: BacktestData) => {
    const entryPrice = Number(item.open);
    const exitPrice = exitMethod === 'at close' ? Number(item.close) : Number(item.high);
    const stopLossPrice = entryPrice * 1.3; // 30% higher than open

    if (Number(item.high) >= stopLossPrice) {
      return -((stopLossPrice - entryPrice) / entryPrice) * 100;
    } else {
      return -((exitPrice - entryPrice) / entryPrice) * 100;
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Backtest - Backtest tool</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation 
        selectedStrategy={selectedStrategy}
        setSelectedStrategy={setSelectedStrategy}
      />

      <main className={styles.main}>
        <h1 className={styles.title}>Backtest: {selectedStrategy}</h1>
        
        <div className={styles.backtestSettings}>
          <div className={styles.settingGroup}>
            <label htmlFor="entryMethod">Entry method:</label>
            <select 
              id="entryMethod" 
              value={entryMethod} 
              onChange={(e) => setEntryMethod(e.target.value)}
              className={styles.comboBox}
            >
              <option value="at open">at open</option>
              {/* Add more options as needed */}
            </select>
          </div>

          <div className={styles.settingGroup}>
            <label htmlFor="exitMethod">Exit method:</label>
            <select 
              id="exitMethod" 
              value={exitMethod} 
              onChange={(e) => setExitMethod(e.target.value)}
              className={styles.comboBox}
            >
              <option value="at close">at close</option>
              <option value="at high">at high</option>
              {/* Add more options as needed */}
            </select>
          </div>

          <div className={styles.settingGroup}>
            <label htmlFor="stopLossMethod">Stop loss method:</label>
            <select 
              id="stopLossMethod" 
              value={stopLossMethod} 
              onChange={(e) => setStopLossMethod(e.target.value)}
              className={styles.comboBox}
            >
              <option value="30% higher than open">30% higher than open</option>
              {/* Add more options as needed */}
            </select>
          </div>
        </div>

        <div className={styles.chartContainer}>
          <Line data={chartData} options={{
            responsive: true,
            plugins: {
              legend: {
                position: 'top' as const,
              },
              title: {
                display: true,
                text: 'Accumulative Profit Over Time',
              },
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'Date',
                },
              },
              y: {
                title: {
                  display: true,
                  text: 'Accumulative Profit (%)',
                },
              },
            },
          }} />
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thLeftAlign}>Date</th>
                <th className={styles.thLeftAlign}>Ticker</th>
                <th className={styles.thLeftAlign}>Open</th>
                <th className={styles.thLeftAlign}>Close</th>
                <th className={styles.thLeftAlign}>High</th>
                <th className={styles.thLeftAlign}>Low</th>
                <th className={styles.thLeftAlign}>Gap Up %</th>
                <th className={styles.thLeftAlign}>Spike %</th>
                <th className={styles.thLeftAlign}>O2C %</th>
                <th className={styles.thLeftAlign}>Volume</th>
                <th className={styles.thLeftAlign}>Float</th>
                <th className={styles.thLeftAlign}>Market Cap</th>
                <th className={styles.thLeftAlign}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {backtestData.map((item, index) => (
                <tr key={index}>
                  <td>{format(new Date(item.date), 'dd-MM-yy')}</td>
                  <td>{item.ticker}</td>
                  <td>{Number(item.open).toFixed(2)}</td>
                  <td>{Number(item.close).toFixed(2)}</td>
                  <td>{Number(item.high).toFixed(2)}</td>
                  <td>{Number(item.low).toFixed(2)}</td>
                  <td>{Number(item.gap_up_percentage).toFixed(2)}%</td>
                  <td>{Number(item.spike_percentage).toFixed(2)}%</td>
                  <td>{Number(item.o2c_percentage).toFixed(2)}%</td>
                  <td>{Number(item.volume).toLocaleString()}</td>
                  <td>{item.float ? Number(item.float).toLocaleString() : 'N/A'}</td>
                  <td>{item.market_cap ? Number(item.market_cap).toLocaleString() : 'N/A'}</td>
                  <td className={calculateProfit(item) >= 0 ? styles.profitPositive : styles.profitNegative}>
                    {calculateProfit(item).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}