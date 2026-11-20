import { ChartNoAxesCombined } from 'lucide-react';
import { useState } from 'react';
import { usEconomyObservations } from './usEconomyData';

const ranges = [
  { label: 'YTD', months: 0 },
  { label: '3Y', months: 36 },
  { label: '5Y', months: 60 },
  { label: '10Y', months: 120 },
] as const;

const indicators = [
  {
    id: 'interest',
    column: 1,
    name: 'Interest rate',
    description: 'Effective federal funds rate',
    digits: 2,
    source: 'https://fred.stlouisfed.org/series/FEDFUNDS',
  },
  {
    id: 'employment',
    column: 2,
    name: 'Employment rate',
    description: 'Employment-to-population ratio, 16+',
    digits: 1,
    source: 'https://fred.stlouisfed.org/series/EMRATIO',
  },
  {
    id: 'inflation',
    column: 3,
    name: 'Inflation rate',
    description: 'Headline CPI, year over year',
    digits: 1,
    source: 'https://fred.stlouisfed.org/series/CPIAUCNS',
  },
] as const;

type Indicator = (typeof indicators)[number];
type Observations = typeof usEconomyObservations;

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const newestFirst = [...usEconomyObservations].reverse();
const latestMonth = newestFirst[0][0];

function formatMonth(month: string) {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

function EconomyTrend({ name, values }: { name: string; values: readonly (number | null)[] }) {
  const reported = values.filter((value) => value !== null);
  if (reported.length === 0) return <p className="market-panel-note">No observations in this range.</p>;

  const lowest = Math.min(...reported);
  const highest = Math.max(...reported);
  const minTick = Math.floor(lowest);
  const maxTick = Math.max(minTick + 1, Math.ceil(highest));
  const ticks = [maxTick, (maxTick + minTick) / 2, minTick];
  const width = 240;
  const inset = 3;
  const plotHeight = 86;
  let drawing = false;
  const path = values.map((value, index) => {
    if (value === null) {
      drawing = false;
      return '';
    }
    const x = inset + (width - 2 * inset) * index / Math.max(1, values.length - 1);
    const y = inset + plotHeight * (maxTick - value) / (maxTick - minTick);
    const command = drawing ? 'L' : 'M';
    drawing = true;
    return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  return (
    <div className="economy-trend" role="img"
      aria-label={`${name} trend. Monthly observations range from ${lowest.toFixed(2)}% to ${highest.toFixed(2)}%.`}>
      <div className="economy-trend-scale" aria-hidden="true">
        {ticks.map((tick) => <span key={tick}>{tick}%</span>)}
      </div>
      <svg viewBox={`0 0 ${width} ${plotHeight + 2 * inset}`} preserveAspectRatio="none" aria-hidden="true">
        {ticks.map((tick, index) => (
          <line key={tick} x1="0" x2={width} y1={inset + index * plotHeight / 2} y2={inset + index * plotHeight / 2} />
        ))}
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function EconomyIndicator({ indicator, observations }: { indicator: Indicator; observations: Observations }) {
  const { id, column, name, description, digits, source } = indicator;
  const lastReport = newestFirst.find((row) => row[column] !== null);
  const latest = lastReport?.[column];

  return (
    <article className="economy-indicator" data-indicator={id} aria-labelledby={`economy-${id}`}>
      <h3 id={`economy-${id}`}>{name}</h3>
      <p className="economy-definition">{description}</p>
      <div className="economy-latest">
        <strong>{latest == null ? 'Unavailable' : `${latest.toFixed(digits)}%`}</strong>
        {lastReport && <time dateTime={lastReport[0]}>{formatMonth(lastReport[0])}</time>}
      </div>
      <EconomyTrend name={name} values={observations.map((row) => row[column])} />
      <a className="economy-source" href={source}>FRED source<span className="sr-only"> for {name.toLowerCase()}</span></a>
    </article>
  );
}

export function UsEconomy() {
  const [range, setRange] = useState<(typeof ranges)[number]>(ranges[3]);
  const observations = range.months
    ? usEconomyObservations.slice(-range.months)
    : usEconomyObservations.filter(([month]) => month.startsWith(latestMonth.slice(0, 4)));

  return (
    <section className="panel us-economy" aria-labelledby="us-economy-title">
      <div className="panel-header">
        <h2 id="us-economy-title"><ChartNoAxesCombined size={18} aria-hidden="true" /> U.S. economy</h2>
        <span className="market-panel-note">Monthly snapshot</span>
      </div>
      <div className="us-economy-body">
        <div className="market-index-controls">
          <div className="market-region-options" role="group" aria-label="U.S. economy chart range">
            {ranges.map((item) => (
              <button key={item.label} type="button" aria-pressed={item === range} onClick={() => setRange(item)}>
                {item.label}
              </button>
            ))}
          </div>
          <p className="market-panel-note" aria-live="polite">{formatMonth(observations[0][0])} – {formatMonth(latestMonth)}</p>
        </div>
        <div className="economy-indicators">
          {indicators.map((indicator) => <EconomyIndicator key={indicator.id} indicator={indicator} observations={observations} />)}
        </div>
        <p className="economy-data-note">
          October 2026 annual inflation is unavailable because October 2025 CPI data were not collected.{' '}
          <a href="https://www.bls.gov/cpi/notices/2026/12m-changes-202610.htm">BLS notice</a>
        </p>
      </div>
    </section>
  );
}
