import { CornerUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { companyNames, formatChange, moverBenchmarks, moverRanges, sampleMovers } from './marketData';
import type { MoverBenchmark, MoverKind, MoverRange } from './marketData';

const moverKinds = [
  { kind: 'loss', label: 'Top Loss', icon: TrendingDown },
  { kind: 'gain', label: 'Top Gains', icon: TrendingUp },
  { kind: 'rebound', label: 'Top Rebound', icon: CornerUpRight },
] as const satisfies readonly { kind: MoverKind; label: string; icon: typeof TrendingDown }[];

export function TopMovers() {
  const [benchmark, setBenchmark] = useState<MoverBenchmark>('sp500');
  const [range, setRange] = useState<MoverRange>('12m');
  const results = sampleMovers[benchmark][range];

  function moveTabFocus(event: KeyboardEvent<HTMLDivElement>) {
    const current = moverRanges.findIndex((item) => item.id === range);
    const last = moverRanges.length - 1;
    let next: number;

    switch (event.key) {
      case 'ArrowLeft': next = current === 0 ? last : current - 1; break;
      case 'ArrowRight': next = current === last ? 0 : current + 1; break;
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      default: return;
    }

    event.preventDefault();
    setRange(moverRanges[next].id);
    event.currentTarget.querySelectorAll('button')[next]?.focus();
  }

  return (
    <aside className="panel market-movers" aria-labelledby="market-movers-title">
      <div className="panel-header">
        <h2 id="market-movers-title">Top movers</h2>
        <span className="market-sample-label">Sample data</span>
      </div>
      <div className="market-mover-controls">
        <div className="market-mover-benchmarks" role="group" aria-label="Mover benchmark">
          {moverBenchmarks.map(({ id, name }) => (
            <button key={id} type="button" aria-pressed={benchmark === id} onClick={() => setBenchmark(id)}>
              {name}
            </button>
          ))}
        </div>
        <div className="market-mover-ranges" role="tablist" aria-label="Mover time range" onKeyDown={moveTabFocus}>
          {moverRanges.map(({ id, label, name }) => (
            <button
              key={id}
              id={`market-movers-${id}`}
              type="button"
              role="tab"
              aria-label={name}
              aria-selected={range === id}
              aria-controls="market-movers-results"
              tabIndex={range === id ? 0 : -1}
              onClick={() => setRange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div id="market-movers-results" role="tabpanel" aria-labelledby={`market-movers-${range}`} tabIndex={0}>
        {moverKinds.map(({ kind, label, icon: Icon }) => {
          const [symbol, change] = results[kind];

          return (
            <div className="market-mover" key={kind} data-kind={kind}>
              <span className="market-mover-icon"><Icon size={16} aria-hidden="true" /></span>
              <div className="market-mover-copy">
                <h3>{label}</h3>
                <p><strong>{symbol}</strong> <span>{companyNames[symbol]}</span></p>
                {kind === 'rebound' && <p className="market-mover-basis">From the period low</p>}
              </div>
              <strong className="market-mover-change">{formatChange.format(change)}</strong>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
