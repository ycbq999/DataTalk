export const formatChange = new Intl.NumberFormat('en-US', {
  style: 'percent',
  signDisplay: 'exceptZero',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const moverRanges = [
  { id: '1m', label: '1M', name: '1 month' },
  { id: '3m', label: '3M', name: '3 months' },
  { id: '12m', label: '12M', name: '12 months' },
  { id: '3y', label: '3Y', name: '3 years' },
  { id: '5y', label: '5Y', name: '5 years' },
] as const;

export const moverBenchmarks = [
  { id: 'sp500', name: 'S&P 500' },
  { id: 'nasdaq100', name: 'Nasdaq-100' },
] as const;

export type MoverRange = (typeof moverRanges)[number]['id'];
export type MoverBenchmark = (typeof moverBenchmarks)[number]['id'];
export type MoverKind = 'loss' | 'gain' | 'rebound';

export const companyNames = {
  AMD: 'Advanced Micro Devices',
  AMZN: 'Amazon',
  AVGO: 'Broadcom',
  CRM: 'Salesforce',
  DIS: 'Walt Disney',
  F: 'Ford Motor',
  GE: 'GE Aerospace',
  INTC: 'Intel',
  META: 'Meta Platforms',
  NVDA: 'NVIDIA',
  PYPL: 'PayPal',
  QCOM: 'Qualcomm',
  TSLA: 'Tesla',
} as const;

type MoverExample = readonly [symbol: keyof typeof companyNames, change: number];
type MoverResults = Record<MoverKind, MoverExample>;

// Illustrative rankings and changes, grouped by benchmark and lookback period.
export const sampleMovers = {
  sp500: {
    '1m': { loss: ['F', -0.123], gain: ['GE', 0.214], rebound: ['DIS', 0.286] },
    '3m': { loss: ['CRM', -0.312], gain: ['AVGO', 0.373], rebound: ['DIS', 0.549] },
    '12m': { loss: ['F', -0.441], gain: ['NVDA', 0.824], rebound: ['GE', 1.012] },
    '3y': { loss: ['F', -0.543], gain: ['NVDA', 2.661], rebound: ['GE', 3.318] },
    '5y': { loss: ['F', -0.647], gain: ['NVDA', 6.354], rebound: ['NVDA', 7.854] },
  },
  nasdaq100: {
    '1m': { loss: ['QCOM', -0.111], gain: ['AMD', 0.183], rebound: ['AMZN', 0.227] },
    '3m': { loss: ['TSLA', -0.276], gain: ['AVGO', 0.373], rebound: ['TSLA', 0.428] },
    '12m': { loss: ['INTC', -0.386], gain: ['NVDA', 0.824], rebound: ['TSLA', 0.934] },
    '3y': { loss: ['PYPL', -0.482], gain: ['NVDA', 2.661], rebound: ['META', 3.018] },
    '5y': { loss: ['PYPL', -0.598], gain: ['NVDA', 6.354], rebound: ['NVDA', 7.854] },
  },
} as const satisfies Record<MoverBenchmark, Record<MoverRange, MoverResults>>;
