// Watchlist configuration — curated markets by category
// These get full snapshot history stored every poll cycle

export type Category = 'fed' | 'recession' | 'oil' | 'geopolitics' | 'indices';

export interface WatchlistEntry {
  series_ticker: string;
  category: Category;
  title: string;
  description: string;
  correlated_series: string[];
}

export const WATCHLIST: WatchlistEntry[] = [
  // Fed / Monetary Policy
  { series_ticker: 'KXFEDDECISION', category: 'fed', title: 'Fed Rate Decision', description: 'Next FOMC meeting rate decision', correlated_series: ['KXFEDCUTS', 'KXFEDFUNDSRATE', 'INXD'] },
  { series_ticker: 'KXFEDCUTS', category: 'fed', title: 'Fed Rate Cuts 2026', description: 'Number of rate cuts this year', correlated_series: ['KXFEDDECISION', 'KXFEDFUNDSRATE'] },
  { series_ticker: 'KXFEDFUNDSRATE', category: 'fed', title: 'Fed Funds Rate Year-End', description: 'Where the Fed funds rate lands EOY', correlated_series: ['KXFEDDECISION', 'KXFEDCUTS'] },

  // Recession / Economic
  { series_ticker: 'KXRECSSNBER', category: 'recession', title: 'US Recession 2026 (NBER)', description: 'Probability of NBER-declared recession', correlated_series: ['INXD', 'NASDAQ', 'TREASURY10Y'] },
  { series_ticker: 'KXCPI', category: 'recession', title: 'CPI Inflation', description: 'Monthly CPI data release', correlated_series: ['KXFEDDECISION', 'KXFEDCUTS', 'TREASURY10Y'] },
  { series_ticker: 'KXGDP', category: 'recession', title: 'GDP Growth', description: 'Quarterly GDP growth rate', correlated_series: ['KXRECSSNBER', 'INXD'] },
  { series_ticker: 'KXUNEMPLOYMENT', category: 'recession', title: 'Unemployment Rate', description: 'Monthly unemployment data', correlated_series: ['KXRECSSNBER', 'KXFEDDECISION'] },

  // Oil / Energy
  { series_ticker: 'INX', category: 'oil', title: 'WTI Oil Price', description: 'WTI crude oil price daily/weekly', correlated_series: ['KXCLOSEHORMUZ', 'GOLD'] },
  { series_ticker: 'GASPRICES', category: 'oil', title: 'US Gas Prices', description: 'National average gas prices', correlated_series: ['INX'] },

  // Geopolitics
  { series_ticker: 'KXCLOSEHORMUZ', category: 'geopolitics', title: 'Strait of Hormuz', description: 'Hormuz closure/normalization probability', correlated_series: ['INX', 'GOLD', 'KXIRANWAR'] },
  { series_ticker: 'KXIRANWAR', category: 'geopolitics', title: 'Iran Conflict', description: 'US-Iran conflict escalation', correlated_series: ['KXCLOSEHORMUZ', 'INX', 'GOLD'] },
  { series_ticker: 'KXIRANNUS', category: 'geopolitics', title: 'US-Iran Negotiations', description: 'US-Iran ceasefire/deal probability', correlated_series: ['KXCLOSEHORMUZ', 'KXIRANWAR'] },

  // Indices / Financial
  { series_ticker: 'INXD', category: 'indices', title: 'S&P 500 Daily', description: 'S&P 500 daily range market', correlated_series: ['KXRECSSNBER', 'NASDAQ', 'KXFEDDECISION'] },
  { series_ticker: 'NASDAQ', category: 'indices', title: 'NASDAQ-100', description: 'NASDAQ-100 year-end outlook', correlated_series: ['INXD', 'KXFEDDECISION'] },
  { series_ticker: 'TREASURY10Y', category: 'indices', title: '10-Year Treasury Yield', description: 'US 10-year yield range', correlated_series: ['KXFEDDECISION', 'KXRECSSNBER'] },
  { series_ticker: 'GOLD', category: 'indices', title: 'Gold Price', description: 'Gold price daily/weekly', correlated_series: ['KXCLOSEHORMUZ', 'INX', 'KXRECSSNBER'] },
];

export const WATCHLIST_SERIES_SET = new Set(WATCHLIST.map(w => w.series_ticker));

export const CATEGORY_META: Record<Category, { label: string; color: string; icon: string }> = {
  fed:        { label: 'Fed / Monetary', color: '#3b82f6', icon: '🏦' },
  recession:  { label: 'Recession / Economy', color: '#ef4444', icon: '📉' },
  oil:        { label: 'Oil / Energy', color: '#f59e0b', icon: '🛢️' },
  geopolitics:{ label: 'Geopolitics', color: '#8b5cf6', icon: '🌍' },
  indices:    { label: 'Markets / Indices', color: '#10b981', icon: '📊' },
};
