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

interface DeathCandle {
  timestamp: number;
  time: string;
  open: number;
  close: number;
  high: number;
  low: number;
  openToClosePercentage: number;
  highToClosePercentage: number;
  priorFifteenMinutesChange: number;
}

export default function Backtest() {
  const [selectedStrategy, setSelectedStrategy] = useState('Gap Up Short');
  const [entryMethod, setEntryMethod] = useState('at open');
  const [exitMethod, setExitMethod] = useState('at close');
  const [stopLossMethod, setStopLossMethod] = useState('30% higher than open');
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
  }, [selectedDataSet, entryMethod, exitMethod, stopLossMethod]);

  useEffect(() => {
    if (backtestData.length > 0) {
      const updatedData = backtestData.map(item => {
        const entryPrice = item.entryPrice || Number(item.open);
        const exitPrice = item.exitPrice || Number(item.close);
        return {
          ...item,
          profit: calculateProfit(item, entryPrice, exitPrice)
        };
      });
      setBacktestData(updatedData);
      updateChartData(updatedData);
      calculateStats(updatedData);
    }
  }, [applyCommissions, commissions, entryMethod, exitMethod, stopLossMethod]);

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
        body: JSON.stringify({ dataSetName: selectedDataSet, entryMethod, exitMethod, stopLossMethod }),
      });
      const data = await response.json();
      
      if (data && data.length > 0) {
        const updatedData = await Promise.all(data.map(async (item: BacktestData) => {
          let entryPrice = Number(item.open);
          let exitPrice = Number(item.close);
          let includeRecord = true;
          let deathCandleInfo: DeathCandle | null = null;

          if (entryMethod === 'at 1st Death Candle') {
            const formattedDate = format(new Date(item.date), 'yyyy-MM-dd');
            const deathCandleResponse = await fetch(`/api/checkDeathCandleExist?ticker=${item.ticker}&date=${formattedDate}`);
            const deathCandleData = await deathCandleResponse.json();
            if (deathCandleData.deathCandlesExist) {
              deathCandleInfo = deathCandleData.deathCandles[0];
              entryPrice = deathCandleInfo.close;
            } else {
              includeRecord = false;
            }
          }

          if (exitMethod === 'at high') {
            exitPrice = Number(item.high);
          }

          return includeRecord ? {
            ...item,
            entryPrice,
            exitPrice,
            profit: calculateProfit(item, entryPrice, exitPrice),
            deathCandleInfo
          } : null;
        }));

        const filteredData = updatedData.filter((item): item is BacktestData & { deathCandleInfo: DeathCandle | null } => item !== null);
        const sortedData = sortResults(filteredData, sortConfig);
        setBacktestData(sortedData);
        updateChartData(sortedData);
        calculateStats(sortedData);
      }
    } catch (error) {
      console.error('Error fetching backtest data:', error);
    }
  };

  const calculateProfit = (item: BacktestData, entryPrice: number, exitPrice: number) => {
    const stopLossPrice = stopLossMethod === '30% higher than open' 
      ? Number(item.open) * 1.3 
      : entryPrice * 1.3;

    let profit;
    if (Number(item.high) >= stopLossPrice) {
      profit = -((stopLossPrice - entryPrice) / entryPrice) * 100;
    } else {
      profit = -((exitPrice - entryPrice) / entryPrice) * 100;
    }

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
    const totalTrades = data.length;
    
    const profitableTrades = data.filter(item => item.profit && item.profit > 0).length;
    const percentProfitable = (profitableTrades / totalTrades) * 100;

    let maxDrawdown = 0;
    let peak = 0;
    let accumulativeProfit = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    const dailyReturns: number[] = [];
    let previousAccumulativeProfit = 0;

    data.forEach(item => {
      const profit = item.profit ?? 0;
      accumulativeProfit += profit;
      
      if (profit > 0) {
        totalProfit += profit;
      } else {
        totalLoss -= profit; // Note: profit is negative here
      }

      if (accumulativeProfit > peak) {
        peak = accumulativeProfit;
      }
      const drawdown = peak - accumulativeProfit;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      // Calculate daily return
      const dailyReturn = accumulativeProfit - previousAccumulativeProfit;
      dailyReturns.push(dailyReturn);
      previousAccumulativeProfit = accumulativeProfit;
    });

    const avgTrade = accumulativeProfit / totalTrades;

    // Calculate Profit Factor
    const profitFactor = totalLoss !== 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    // Calculate Sharpe Ratio
    const avgDailyReturn = dailyReturns.reduce((sum, return_) => sum + return_, 0) / dailyReturns.length;
    const stdDevDailyReturn = Math.sqrt(
      dailyReturns.reduce((sum, return_) => sum + Math.pow(return_ - avgDailyReturn, 2), 0) / dailyReturns.length
    );
    const sharpeRatio = stdDevDailyReturn !== 0 ? (avgDailyReturn / stdDevDailyReturn) * Math.sqrt(252) : 0; // Annualized

    setStats({
      totalTrades,
      percentProfitable,
      profitFactor,
      maxDrawdown,
      avgTrade,
      sharpeRatio,
    });
  };

  const handleDeleteDataset = async (datasetName: string) => {
    if (confirm(`Are you sure you want to delete the dataset "${datasetName}" and all related records?`)) {
      try {
        const response = await fetch('/api/deleteDataset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ datasetName }),
        });
        
        if (response.ok) {
          // Remove the deleted dataset from the list
          setDataSetNames(prevNames => prevNames.filter(name => name !== datasetName));
          
          // If the deleted dataset was selected, reset the selection
          if (selectedDataSet === datasetName) {
            setSelectedDataSet('');
            setBacktestData([]);
            setChartData({ labels: [], datasets: [] });
          }
        } else {
          const errorData = await response.json();
          console.error('Failed to delete dataset:', errorData.message);
          alert(`Failed to delete dataset: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Error deleting dataset:', error);
        alert(`Error deleting dataset: ${error instanceof Error ? error.message : String(error)}`);        
      }
    }
  };

  const handleApplyCommissionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApplyCommissions(e.target.checked);
  };

  const handleCommissionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCommissions(e.target.value);
  };

  const handleSort = (key: keyof BacktestData) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    
    const sortedData = sortResults(backtestData, { key, direction });
    setBacktestData(sortedData);
  };

  const sortResults = (data: BacktestData[], sortConfig: SortConfig) => {
    return [...data].sort((a, b) => {
      let aValue: number = 0;
      let bValue: number = 0;

      // Convert values to numbers, treating non-numeric values as 0
      const numericKeys: (keyof BacktestData)[] = [
        'open', 'close', 'high', 'low', 'gap_up_percentage', 'spike_percentage',
        'o2c_percentage', 'volume', 'float', 'market_cap', 'profit'
      ];

      if (numericKeys.includes(sortConfig.key)) {
        aValue = Number(a[sortConfig.key]) || 0;
        bValue = Number(b[sortConfig.key]) || 0;
      } else if (sortConfig.key === 'date') {
        return sortConfig.direction === 'ascending' 
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        aValue = a[sortConfig.key] as number;
        bValue = b[sortConfig.key] as number;
      }

      if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
  };

  const getSortIndicator = (key: keyof BacktestData) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    }
    return '';
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
            <label htmlFor="entryMethod">Entry method:</label>
            <select 
              id="entryMethod" 
              value={entryMethod} 
              onChange={(e) => setEntryMethod(e.target.value)}
              className={styles.comboBox}
            >
              <option value="at open">at open</option>
              <option value="at 1st Death Candle">at 1st Death Candle</option>
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
              <option value="30% higher than entry price">30% higher than entry price</option>
            </select>
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
                  <th className={styles.thLeftAlign} onClick={() => handleSort('entryPrice')}>
                    Entry Price{getSortIndicator('entryPrice')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('exitPrice')}>
                    Exit Price{getSortIndicator('exitPrice')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('profit')}>
                    Profit{getSortIndicator('profit')}
                  </th>
                  <th className={styles.thLeftAlign} onClick={() => handleSort('deathCandleInfo.priorFifteenMinutesChange')}>
                    15min Change{getSortIndicator('deathCandleInfo.priorFifteenMinutesChange')}
                  </th>
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
                    <td>{item.entryPrice?.toFixed(2)}</td>
                    <td>{item.exitPrice?.toFixed(2)}</td>
                    <td className={item.profit !== undefined && item.profit >= 0 ? styles.profitPositive : styles.profitNegative}>
                      {item.profit !== undefined ? item.profit.toFixed(2) : 'N/A'}%
                    </td>
                    <td>{item.deathCandleInfo ? `${item.deathCandleInfo.priorFifteenMinutesChange.toFixed(2)}%` : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}