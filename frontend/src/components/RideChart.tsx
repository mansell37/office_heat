export interface Sample {
  p?: number; // power, watts
  c?: number; // cadence, rpm
}

const W = 1000;
const H = 200;

function line(values: (number | undefined)[], max: number): string {
  const pts: string[] = [];
  const n = values.length;
  values.forEach((v, i) => {
    if (v == null) return;
    const x = n <= 1 ? 0 : (i / (n - 1)) * W;
    const y = H - Math.min(1, v / max) * H;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return pts.join(" ");
}

/** Lightweight dependency-free SVG chart of power + cadence over the ride. */
export default function RideChart({ samples }: { samples: Sample[] }) {
  if (samples.length < 2) {
    return (
      <div className="ride-chart empty muted">
        Power &amp; cadence chart appears as you ride…
      </div>
    );
  }

  const powers = samples.map((s) => s.p);
  const cadences = samples.map((s) => s.c);
  const maxP = Math.max(150, ...powers.map((p) => p ?? 0)) * 1.05;
  const maxC = 130; // typical cadence ceiling

  return (
    <div className="ride-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="ride-chart-svg">
        <polyline
          points={line(cadences, maxC)}
          fill="none"
          stroke="var(--blue)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          opacity={0.7}
        />
        <polyline
          points={line(powers, maxP)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="ride-chart-legend">
        <span className="lg pwr">● Power</span>
        <span className="lg cad">● Cadence</span>
      </div>
    </div>
  );
}
