import { Globe2 } from 'lucide-react';
import { useState } from 'react';
import worldLand from './assets/world-land.svg';
import { formatChange } from './marketData';
import { TopMovers } from './TopMovers';
import { UsEconomy } from './UsEconomy';

const sampleEvents = [
  { title: 'GTA VI release', category: 'Gaming', day: 6 },
  { title: 'SpaceX Starship test flight', category: 'Spaceflight', day: 14 },
  { title: 'U.S. inflation report', category: 'Economy', day: 23 },
] as const;

const sentiment = { score: 68, previousClose: 64, weekAgo: 51 };
const sentimentBands = [
  { label: 'Extreme fear', color: '#e9868d' },
  { label: 'Fear', color: '#eca681' },
  { label: 'Neutral', color: '#dfc680' },
  { label: 'Greed', color: '#95edbe' },
  { label: 'Extreme greed', color: '#5bbfa7' },
];

const regions = [
  {
    id: 'americas', name: 'Americas', left: '29.44%', top: '30.81%',
    indices: [
      { name: 'S&P 500', closes: [5894.12, 5920.14, 5908.23, 5958.37, 6003.13, 6034.50] },
      { name: 'Nasdaq Composite', closes: [18860.71, 18940.36, 18902.18, 19138.91, 19169.25, 19344.12] },
      { name: 'S&P/TSX Composite', closes: [25248.04, 25291.15, 25136.11, 25226.46, 25164.38, 25126.62] },
    ],
  },
  {
    id: 'europe', name: 'Europe', left: '49.96%', top: '24.68%',
    indices: [
      { name: 'STOXX Europe 600', closes: [533.43, 536.21, 535.46, 539.12, 539.58, 541.23] },
      { name: 'FTSE 100', closes: [8520.14, 8512.92, 8549.11, 8589.95, 8601.42, 8587.38] },
      { name: 'DAX', closes: [22944.88, 23063.12, 23031.39, 23075.14, 23122.41, 23267.56] },
    ],
  },
  {
    id: 'asia-pacific', name: 'Asia-Pacific', left: '88.80%', top: '33.44%',
    indices: [
      { name: 'Nikkei 225', closes: [39248.38, 39112.56, 39420.18, 39667.81, 39614.23, 39814.33] },
      { name: 'Hang Seng', closes: [23139.75, 23018.12, 23277.63, 23153.93, 23017.43, 22891.90] },
      { name: 'S&P/ASX 200', closes: [7996.36, 7980.65, 8001.48, 8022.39, 8026.12, 8055.84] },
    ],
  },
] as const;

const formatIndex = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function gaugePoint(score: number) {
  const angle = Math.PI * (1 - score / 100);
  return { x: 120 + 95 * Math.cos(angle), y: 112 - 95 * Math.sin(angle) };
}

function MarketSentiment() {
  const marker = gaugePoint(sentiment.score);
  const band = sentimentBands[Math.min(Math.floor(sentiment.score / 20), sentimentBands.length - 1)];

  return (
    <section className="panel market-sentiment" aria-labelledby="market-sentiment-title">
      <div className="panel-header">
        <h2 id="market-sentiment-title">Fear &amp; Greed</h2>
        <span className="market-sample-label">Sample data</span>
      </div>
      <div className="market-sentiment-body">
        <div
          className="market-gauge"
          role="meter"
          aria-label="Fear and greed score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={sentiment.score}
          aria-valuetext={`${sentiment.score} of 100, ${band.label}`}
        >
          <svg viewBox="0 0 240 126" aria-hidden="true">
            {sentimentBands.map(({ label, color }, index) => {
              const start = gaugePoint(index * 20 + 2);
              const end = gaugePoint((index + 1) * 20 - 2);
              return <path key={label} d={`M ${start.x} ${start.y} A 95 95 0 0 1 ${end.x} ${end.y}`}
                fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />;
            })}
            <circle cx={marker.x} cy={marker.y} r={7} fill="#111a28" stroke="#eff5ff" strokeWidth={3} />
            <text className="market-gauge-score" x={120} y={85} textAnchor="middle">{sentiment.score}</text>
            <text className="market-gauge-band" x={120} y={107} textAnchor="middle" fill={band.color}>{band.label}</text>
          </svg>
          <div className="market-gauge-labels" aria-hidden="true"><span>0 · Extreme fear</span><span>Extreme greed · 100</span></div>
        </div>
        <dl className="market-sentiment-history">
          <div><dt>Previous close</dt><dd>{sentiment.previousClose}</dd></div>
          <div><dt>One week ago</dt><dd>{sentiment.weekAgo}</dd></div>
        </dl>
      </div>
    </section>
  );
}

function IndexTrend({ name, closes }: { name: string; closes: readonly [number, number, ...number[]] }) {
  const count = closes.length;
  const first = closes[0];
  const latest = closes[count - 1];
  const previous = closes[count - 2];
  const change = latest / previous - 1;
  const low = Math.min(...closes);
  const range = Math.max(...closes) - low || 1;
  const points = closes.map((close, index) => `${index * 160 / (count - 1)},${42 - (close - low) * 36 / range}`).join(' ');

  return (
    <div className="market-index" data-direction={change < 0 ? 'down' : 'up'}>
      <h3>{name}</h3>
      <p className="market-index-price">
        <strong>{formatIndex.format(latest)}</strong>
        <span title="Change from previous close">{formatChange.format(change)}</span>
      </p>
      <svg viewBox="0 0 160 48" preserveAspectRatio="none" role="img"
        aria-label={`${count} sample closes, from ${formatIndex.format(first)} to ${formatIndex.format(latest)} index points`}>
        <polygon points={`0,48 ${points} 160,48`} fill="currentColor" opacity=".12" />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function WorldMarkets() {
  const [region, setRegion] = useState<(typeof regions)[number]>(regions[0]);

  return (
    <section className="panel world-markets" aria-labelledby="world-markets-title">
      <div className="panel-header">
        <h2 id="world-markets-title"><Globe2 size={18} aria-hidden="true" /> World markets</h2>
        <span className="market-sample-label">Sample data</span>
      </div>
      <div className="world-markets-body">
        <div className="market-index-controls">
          <div className="market-region-options" role="group" aria-label="Market region">
            {regions.map((item) => (
              <button key={item.id} type="button" aria-pressed={item.id === region.id} onClick={() => setRegion(item)}>
                {item.name}
              </button>
            ))}
          </div>
          <span className="market-panel-note">6 closes · 1-day change</span>
        </div>
        <div className="market-index-grid" role="group" aria-label={`${region.name} index charts`}>
          {region.indices.map((index) => <IndexTrend key={index.name} {...index} />)}
        </div>
        <div className="world-map">
          <img src={worldLand} width={720} height={320} alt="" />
          {regions.map((item) => (
            <button
              className="world-map-marker"
              key={item.id}
              type="button"
              style={{ left: item.left, top: item.top }}
              aria-pressed={item.id === region.id}
              aria-label={`Select ${item.name} on the map`}
              onClick={() => setRegion(item)}
            >
              <span className="world-map-dot" />
              <span className="world-map-label" aria-hidden="true">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MarketHome() {
  return (
    <main id="main" className="market-home">
      <div className="market-heading">
        <h1>World Stories</h1>
      </div>

      <div className="market-grid">
        <div className="market-overview">
          <WorldMarkets />
          <UsEconomy />
        </div>

        <div className="market-sidebar">
          <MarketSentiment />
          <TopMovers />

          <aside className="panel market-events" aria-labelledby="market-events-title">
            <div className="panel-header">
              <h2 id="market-events-title">Next 30 Days</h2>
              <span className="market-sample-label">Sample schedule</span>
            </div>
            <ol className="market-event-list" role="list">
              {sampleEvents.map(({ title, category, day }) => (
                <li key={title}>
                  <p className="market-event-meta"><span>{category}</span><span>Day {day}</span></p>
                  <h3>{title}</h3>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </main>
  );
}
