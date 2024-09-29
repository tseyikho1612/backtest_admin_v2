import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import Navigation from '../components/Navigation';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { ChartData } from 'chart.js';
import { format } from 'date-fns';
import { Trash2 } from 'react-feather';

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
  profit?: number;
  entryPrice?: number;
  exitPrice?: number;
}

interface SortConfig {
  key: keyof BacktestData;
  direction: 'ascending' | 'descending';
}

export default function Backtest_v2() {
  const [selectedStrategy, setSelectedStrategy] = useState('Death Candle');
  const strategies = ['Death Candle']; // Add more strategies here as they are implemented
  const [chartData, setChartData] = useState<ChartData<'line'>>({ labels: [], datasets: [] });
  const [backtestData, setBacktestData] = useState<BacktestData[]>([]);
  const [dataSetNames, setDataSetNames] = useState<string[]>([]);
  const [selectedDataSet, setSelectedDataSet] = useState('');
  const [stats, setStats] = useState({
    totalTrades: 0,
    percentProfitable: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    avgTrade: 0,
    sharpeRatio: 0,
  });
  const [commissions, setCommissions] = useState('3');
  const [applyCommissions, setApplyCommissions] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });

  useEffect(() => {
    fetchDataSetNames();
  }, []);


  useEffect(() => {
    if (selectedDataSet) {
      fetchBacktestData();
    }
  }, [selectedDataSet]);

  useEffect(() => {
    if (backtestData.length > 0) {
      const updatedData = backtestData.map(item => ({
        ...item,
        profit: calculateProfit(item)
      }));
      setBacktestData(updatedData);
      updateChartData(updatedData);
      calculateStats(updatedData);
    }
  }, [applyCommissions, commissions]);

  const fetchDataSetNames = async () => {
    try {
      const response = await fetch('/api/getDataSetNames');
      const data = await response.json();
      setDataSetNames(data);
      if (data.length > 0) {
        setSelectedDataSet(data[0]);
      }
    } catch (error) {
      console.error('Error fetching dataset names:', error);
    }
  };


  const fetchBacktestData = async () => {
    try {
      const response = await fetch('/api/getBacktestData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataSetName: selectedDataSet }),
      });
      const data = await response.json();
      
      if (data && data.length > 0) {
        const updatedData = data.map((item: BacktestData) => ({
          ...item,
          entryPrice: Number(item.open),
          exitPrice: Number(item.close),
          profit: calculateProfit(item)
        }));

        const sortedData = sortResults(updatedData, sortConfig);
        setBacktestData(sortedData);
        updateChartData(sortedData);
        calculateStats(sortedData);
      } else {
        setBacktestData([]);
        updateChartData([]);
        calculateStats([]);
      }
    } catch (error) {
      console.error('Error fetching backtest data:', error);
      setBacktestData([]);
      updateChartData([]);
      calculateStats([]);
    }
  };

  const calculateProfit = (item: BacktestData) => {
    const entryPrice = Number(item.open);
    const exitPrice = Number(item.close);
    let profit = -((exitPrice - entryPrice) / entryPrice) * 100;

    if (applyCommissions) {
      profit -= Number(commissions);
    }

    return profit;
  };

  const updateChartData = (data: BacktestData[]) => {
    const labels = data.map((item) => format(new Date(item.date), 'dd-MM-yy'));
    const profits = calculateAccumulativeProfits(data);
    
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
  };

  const calculateAccumulativeProfits = (data: BacktestData[]) => {
    let accumulativeProfit = 0;
    return data.map(item => {
      const profit = item.profit ?? 0;
      accumulativeProfit += profit;
      return accumulativeProfit;
    });
  };

  const calculateStats = (data: BacktestData[]) => {
    // ... (same as in Backtest.tsx)
  };

  const handleDeleteDataset = async (datasetName: string) => {
    // ... (same as in Backtest.tsx)
  };

  const handleApplyCommissionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApplyCommissions(e.target.checked);
  };

  const handleCommissionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCommissions(e.target.value);
  };

  const handleSort = (key: keyof BacktestData) => {
    // ... (same as in Backtest.tsx)
  };

  const sortResults = (data: BacktestData[], config: SortConfig): BacktestData[] => {
    // ... (implementation remains the same, just ensure it returns BacktestData[])
  };

  const getSortIndicator = (key: keyof BacktestData): string => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    }
    return '';
  };

  const handleStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStrategy(e.target.value);
  };

  const handleRunBacktest = () => {
    // TODO: Implement backtest running logic
    console.log('Running backtest with strategy:', selectedStrategy);
    // For now, we'll just call fetchBacktestData
    fetchBacktestData();
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Backtest V2 - Backtest tool</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation 
        selectedStrategy={selectedStrategy}
        setSelectedStrategy={setSelectedStrategy}
      />

      <main className={styles.main}>
        <h1 className={styles.title}>Backtest V2: {selectedStrategy}</h1>
        
        <div className={styles.backtestSettings}>
          <div className={styles.settingGroup}>
            <label htmlFor="dataSet">Dataset:</label>
            <div className={styles.datasetSelectContainer}>
              <select 
                id="dataSet" 
                value={selectedDataSet} 
                onChange={(e) => setSelectedDataSet(e.target.value)}
                className={styles.comboBox}
              >
                {dataSetNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {selectedDataSet && (
                <button
                  className={styles.deleteDatasetButton}
                  onClick={() => handleDeleteDataset(selectedDataSet)}
                  title="Delete selected dataset"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          <div className={styles.settingGroup}>
            <label htmlFor="strategy">Strategy:</label>
            <select 
              id="strategy" 
              value={selectedStrategy} 
              onChange={handleStrategyChange}
              className={styles.comboBox}
            >
              {strategies.map((strategy) => (
                <option key={strategy} value={strategy}>{strategy}</option>
              ))}
            </select>
          </div>

          <div className={styles.settingGroup}>
            <button
              className={styles.runButton}
              onClick={handleRunBacktest}
            >
              Run
            </button>
          </div>

          <div className={styles.settingGroup}>
            <input
              type="checkbox"
              id="applyCommissions"
              checked={applyCommissions}
              onChange={handleApplyCommissionsChange}
              className={styles.checkbox}
            />
            <label htmlFor="commissions">Commissions:</label>
            <input
              type="text"
              id="commissions"
              value={commissions}
              onChange={handleCommissionsChange}
              className={styles.commissionInput}
              style={{ width: '50px' }}
            />
            <span>%</span>
          </div>
        </div>

        <div className={styles.chartAndStatsContainer}>
          <div className={styles.chartContainer}>
            <Line data={chartData} options={{
              responsive: true,
              maintainAspectRatio: false,
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

          <div className={styles.statsContainer}>
            <table className={styles.statsTable}>
              <tbody>
                <tr>
                  <td>Total Trades:</td>
                  <td>{stats.totalTrades}</td>
                </tr>
                <tr>
                  <td>Percent Profitable:</td>
                  <td>{stats.percentProfitable.toFixed(2)}%</td>
                </tr>
                <tr>
                  <td>Profit Factor:</td>
                  <td>{stats.profitFactor.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className={styles.maxDrawdown}>Max Drawdown:</td>
                  <td className={styles.maxDrawdown}>{stats.maxDrawdown.toFixed(2)}%</td>
                </tr>
                <tr>
                  <td>Avg Trade:</td>
                  <td>{stats.avgTrade.toFixed(2)}%</td>
                </tr>
                <tr>
                  <td>Sharpe Ratio:</td>
                  <td>{stats.sharpeRatio.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.backtestResultsContainer}>
          <div className={styles.tableContainer}>
            <table id="backtestResultsTable" className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('date')}>
                    Date{getSortIndicator('date')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('ticker')}>
                    Ticker{getSortIndicator('ticker')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('open')}>
                    Open{getSortIndicator('open')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('close')}>
                    Close{getSortIndicator('close')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('high')}>
                    High{getSortIndicator('high')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('low')}>
                    Low{getSortIndicator('low')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('gap_up_percentage')}>
                    Gap Up %{getSortIndicator('gap_up_percentage')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('spike_percentage')}>
                    Spike %{getSortIndicator('spike_percentage')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('o2c_percentage')}>
                    O2C %{getSortIndicator('o2c_percentage')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('volume')}>
                    Volume{getSortIndicator('volume')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('float')}>
                    Float{getSortIndicator('float')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('market_cap')}>
                    Market Cap{getSortIndicator('market_cap')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('profit')}>
                    Profit{getSortIndicator('profit')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {backtestData && backtestData.length > 0 ? (
                  backtestData.map((item, index) => (
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
                      <td className={item.profit !== undefined && item.profit >= 0 ? styles.profitPositive : styles.profitNegative}>
                        {item.profit !== undefined ? item.profit.toFixed(2) : 'N/A'}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={13}>No data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}