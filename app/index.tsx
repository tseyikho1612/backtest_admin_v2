import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`/api/stockScanner?fromDate=${fromDate}&toDate=${toDate}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4">
      <Head>
        <title>Stock Gap Up Scanner</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="py-8">
        <h1 className="text-3xl font-bold mb-4">Stock Gap Up Scanner</h1>
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex space-x-4">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border p-2"
              required
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border p-2"
              required
            />
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
              Search
            </button>
          </div>
        </form>

        {loading && <p>Loading...</p>}

        {results.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2">Ticker</th>
                <th className="border p-2">Date</th>
                <th className="border p-2">Gap Up %</th>
                <th className="border p-2">Open</th>
                <th className="border p-2">Close</th>
                <th className="border p-2">High</th>
                <th className="border p-2">Low</th>
                <th className="border p-2">Spike %</th>
                <th className="border p-2">O2C %</th>
              </tr>
            </thead>
            <tbody>
              {results.map((stock, index) => (
                <tr key={index}>
                  <td className="border p-2">{stock.ticker}</td>
                  <td className="border p-2">{new Date(stock.date).toLocaleDateString()}</td>
                  <td className="border p-2">{stock.gapUpPercentage}%</td>
                  <td className="border p-2">{stock.open.toFixed(2)}</td>
                  <td className="border p-2">{stock.close.toFixed(2)}</td>
                  <td className="border p-2">{stock.high.toFixed(2)}</td>
                  <td className="border p-2">{stock.low.toFixed(2)}</td>
                  <td className="border p-2">{stock.spikePercentage}%</td>
                  <td className="border p-2">{stock.o2cPercentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}