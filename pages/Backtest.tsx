import { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import Navigation from '../components/Navigation';

export default function Backtest() {
  const [selectedStrategy, setSelectedStrategy] = useState('Gap Up Short');

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
        {/* Add your backtest content here */}
      </main>
    </div>
  );
}