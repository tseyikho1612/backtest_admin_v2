import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

interface NavigationProps {
  selectedStrategy: string;
  setSelectedStrategy: (strategy: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ selectedStrategy, setSelectedStrategy }) => {
  const router = useRouter();

  return (
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
        <Link href="/" passHref>
          <span className={`${styles.navButton} ${router.pathname === '/' ? styles.activeNavButton : ''}`}>
            Data Cleaning
          </span>
        </Link>
        <Link href="/Backtest" passHref>
          <span className={`${styles.navButton} ${router.pathname === '/Backtest' ? styles.activeNavButton : ''}`}>
            Backtest
          </span>
        </Link>
        <Link href="/Backtest_v2" passHref>
          <span className={`${styles.navButton} ${router.pathname === '/Backtest_v2' ? styles.activeNavButton : ''}`}>
            Backtest_v2
          </span>
        </Link>
      </div>
    </nav>
  );
};

export default Navigation;