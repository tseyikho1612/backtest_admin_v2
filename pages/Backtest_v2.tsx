import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import Navigation from '../components/Navigation';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { ChartData } from 'chart.js';
import { format, parse } from 'date-fns';
import { Trash2, Save, Play, List, Download } from 'react-feather';
import { runDeathCandleStrategy, BacktestData, BacktestResult } from '../strategies/DeathCandleStrategy';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface SortConfig {
  key: keyof BacktestResult;
  direction: 'ascending' | 'descending';
}

export default function Backtest_v2() {
  const [selectedStrategy, setSelectedStrategy] = useState('Death Candle');
  const strategies = ['Death Candle']; // Add more strategies here as they are implemented
  const [chartData, setChartData] = useState<ChartData<'line'>>({ labels: [], datasets: [] });
  const [backtestData, setBacktestData] = useState<BacktestResult[]>([]);
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
  const [isLoading, setIsLoading] = useState(false);

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

  const updateChartData = (data: BacktestResult[]) => {
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

  const calculateAccumulativeProfits = (data: BacktestResult[]) => {
    let accumulativeProfit = 0;
    return data.map(item => {
      const profit = Number(item.profit) || 0;
      accumulativeProfit += profit;
      return accumulativeProfit;
    });
  };

  const calculateStats = (data: BacktestResult[]) => {
    const totalTrades = data.length;
    const profitableTrades = data.filter(item => Number(item.profit) > 0).length;
    const percentProfitable = (profitableTrades / totalTrades) * 100;
    
    let maxDrawdown = 0;
    let peak = 0;
    let accumulativeProfit = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    
    data.forEach(item => {
      const profit = Number(item.profit) || 0;
      accumulativeProfit += profit;
      
      if (profit > 0) {
        totalProfit += profit;
      } else {
        totalLoss -= profit;
      }

      if (accumulativeProfit > peak) {
        peak = accumulativeProfit;
      }
      const drawdown = peak - accumulativeProfit;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    const avgTrade = accumulativeProfit / totalTrades;
    const profitFactor = totalLoss !== 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    
    setStats({
      totalTrades,
      percentProfitable,
      profitFactor,
      maxDrawdown,
      avgTrade,
      sharpeRatio: 0, // You may want to implement Sharpe Ratio calculation if needed
    });
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

  const handleRunBacktest = async () => {
    if (!selectedDataSet) {
      alert('Please select a dataset first.');
      return;
    }

    try {
      const response = await fetch('/api/getBacktestData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataSetName: selectedDataSet }),
      });
      const data: BacktestData[] = await response.json();

      let backtestResults: BacktestResult[];

      switch (selectedStrategy) {
        case 'Death Candle':
          backtestResults = await runDeathCandleStrategy(data);
          break;
        // Add more cases for other strategies here
        default:
          throw new Error(`Unknown strategy: ${selectedStrategy}`);
      }

      setBacktestData(backtestResults);
      updateChartData(backtestResults);
      calculateStats(backtestResults);

    } catch (error) {
      console.error('Error running backtest:', error);
      alert(`Error running backtest: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleInsertResults = async () => {
    if (backtestData.length === 0) {
      alert('Please run the backtest first.');
      return;
    }

    try {
      const response = await fetch('/api/insertBacktestResults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSetName: selectedDataSet,
          strategyName: selectedStrategy,
          results: backtestData
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Successfully inserted ${data.insertedCount} records.`);
      } else {
        const errorData = await response.json();
        alert(`Error inserting results: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error inserting backtest results:', error);
      alert(`Error inserting backtest results: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSelectResults = async () => {
    if (!selectedDataSet || !selectedStrategy) {
      alert('Please select both a dataset and a strategy.');
      return;
    }

    try {
      const response = await fetch('/api/selectBacktestResults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSetName: selectedDataSet,
          strategyName: selectedStrategy,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.results as BacktestResult[];
        setBacktestData(results);
        updateChartData(results);
        calculateStats(results);
        // Removed the success alert message
      } else {
        const errorData = await response.json();
        alert(`Error selecting results: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error selecting backtest results:', error);
      alert(`Error selecting backtest results: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  async function handleDownload1minData() {
    try {
      setIsLoading(true);

      // Step 1: Select ticker and date using selectBacktestResults API
      const selectResponse = await fetch('/api/selectBacktestResults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSetName: selectedDataSet,
          strategyName: selectedStrategy,
        }),
      });

      if (!selectResponse.ok) {
        const errorData = await selectResponse.json();
        alert(`Error selecting results: ${errorData.message}`);
        return;
      }

      const { results } = await selectResponse.json();

      if (results.length === 0) {
        alert('No data found for the selected dataset and strategy');
        return;
      }

      // Step 2: Download and insert 1-minute data for each ticker and date
      for (const item of results) {
        const { ticker, date } = item;
        
        // Format date and fetch data from Polygon API
        const parsedDate = parse(date, 'yyyy-MM-dd', new Date());
        const formattedDate = format(parsedDate, 'yyyy-MM-dd');
        
        const response = await fetch(`/api/downloadIntradayData?ticker=${ticker}&date=${formattedDate}`);
        const data = await response.json();

        if (data.error) {
          alert(`Error fetching data for ${ticker} on ${formattedDate}: ${data.error}`);
          continue;
        }

        // Prepare candles data for insertion
        const candles = data.results.map((candle: any) => {
          const candleTime = new Date(candle.t);
          return {
            time: format(candleTime, 'HH:mm:ss'),
            open: candle.o,
            high: candle.h,
            low: candle.l,
            close: candle.c,
            volume: candle.v
          };
        });

        // Insert 1-minute data into the database using the new API
        const insertResponse = await fetch('/api/insertIntraday1minData', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetId: selectedDataSet,
            ticker,
            date: formattedDate,
            candles
          }),
        });

        if (!insertResponse.ok) {
          const errorData = await insertResponse.json();
          alert(`Error inserting data for ${ticker} on ${formattedDate}: ${errorData.message}`);
          continue;
        }

        alert(`Downloaded and inserted 1-minute data for ${ticker} on ${formattedDate}`);
      }

      alert('Finished downloading and inserting 1-minute data for all tickers');
    } catch (error) {
      console.error('Error in handleDownload1minData:', error);
      alert('An error occurred while downloading and inserting 1-minute data');
    } finally {
      setIsLoading(false);
    }
  }

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

            <button
                className={styles.downloadIntradayButton}
                onClick={handleDownload1minData}
                    title="Download 1 min Data"
                  >
                    <Download size={16} />
            </button>

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
              <Play size={16} />
              Run
            </button>
            <button
              className={styles.selectButton}
              onClick={handleSelectResults}
            >
              <List size={16} />
              Select
            </button>
            <button
              className={styles.insertButton}
              onClick={handleInsertResults}
              disabled={backtestData.length === 0}
            >
              <Save size={16} />
              Insert
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
                  <th className={styles.thLeftAlign}>Row</th>
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
                  <th className={styles.thLeftAlign} onClick={() => handleSort('entryTime')}>
                    Entry Time{getSortIndicator('entryTime')}
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
                      <td>{index + 1}</td>
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
                      <td>{item.entryPrice ? Number(item.entryPrice).toFixed(2) : 'N/A'}</td>
                      <td>{item.exitPrice ? Number(item.exitPrice).toFixed(2) : 'N/A'}</td>
                      <td>{item.entryTime || 'N/A'}</td>
                      <td className={item.profit !== undefined && Number(item.profit) >= 0 ? styles.profitPositive : styles.profitNegative}>
                        {item.profit !== undefined && item.profit !== null
                          ? typeof item.profit === 'number'
                            ? item.profit.toFixed(2)
                            : Number(item.profit).toFixed(2)
                          : 'N/A'}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={17}>No data available</td>
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