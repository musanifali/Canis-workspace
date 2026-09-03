/**
 * The web motif, generated (#100). An orb web is radial spokes crossed by
 * spiral threads — the same shape as the product's idea: many anchors, one
 * structure. Generated rather than drawn by hand so the geometry is exact and
 * the whole thing stays a few kB of inline SVG (no image requests, no CLS).
 */

interface WebProps {
  /** Radial spokes. */
  spokes?: number;
  /** Spiral rings. */
  rings?: number;
  className?: string;
  /** Draw-on animation for the hero. */
  animate?: boolean;
}

const SIZE = 600;
const C = SIZE / 2;

/** An orb web sags between spokes — straight lines read as a wheel, not silk. */
function ringPath(radius: number, spokes: number, sag = 0.12): string {
  const pts: string[] = [];
  for (let i = 0; i <= spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
    const x = C + Math.cos(a) * radius;
    const y = C + Math.sin(a) * radius;
    if (i === 0) {
      pts.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
      continue;
    }
    // control point pulled toward the hub → catenary-ish droop
    const mid = (i - 0.5) / spokes * Math.PI * 2 - Math.PI / 2;
    const cr = radius * (1 - sag);
    pts.push(
      `Q ${(C + Math.cos(mid) * cr).toFixed(2)} ${(C + Math.sin(mid) * cr).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`,
    );
  }
  return pts.join(" ");
}

export function Web({ spokes = 16, rings = 7, className, animate = false }: WebProps) {
  const radii = Array.from({ length: rings }, (_, i) => ((i + 1) / rings) * (SIZE / 2 - 10));

  return (
    <svg
      className={className}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* silk catches light near the hub and fades at the rim */}
        <radialGradient id="silk" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--gold-hot)" stopOpacity="0.95" />
          <stop offset="55%" stopColor="var(--gold)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0.06" />
        </radialGradient>
        <radialGradient id="hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--gold-hot)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* spokes */}
      <g stroke="url(#silk)" strokeWidth="1">
        {Array.from({ length: spokes }, (_, i) => {
          const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
          return (
            <line
              key={i}
              x1={C}
              y1={C}
              x2={C + Math.cos(a) * (SIZE / 2 - 10)}
              y2={C + Math.sin(a) * (SIZE / 2 - 10)}
              className={animate ? "thread-draw" : undefined}
              style={animate ? { animationDelay: `${i * 28}ms` } : undefined}
            />
          );
        })}
      </g>

      {/* spiral rings */}
      <g stroke="url(#silk)" strokeWidth="1" fill="none">
        {radii.map((r, i) => (
          <path
            key={r}
            d={ringPath(r, spokes)}
            className={animate ? "thread-draw" : undefined}
            style={animate ? { animationDelay: `${240 + i * 90}ms` } : undefined}
          />
        ))}
      </g>

      <circle cx={C} cy={C} r="60" fill="url(#hub)" />
      <circle cx={C} cy={C} r="2.5" fill="var(--gold-hot)" />
    </svg>
  );
}

/** The mark: a minimal 8-spoke web that still reads at favicon size. */
export function Mark({ size = 26 }: { size?: number }) {
  const c = 16;
  const spokes = 8;
  const spoke = (i: number, r: number) => {
    const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const;
  };
  // one sagging ring, built from the same geometry as the full web
  const ring = (() => {
    const r = 9.5;
    const parts: string[] = [];
    for (let i = 0; i <= spokes; i++) {
      const [x, y] = spoke(i, r);
      if (i === 0) {
        parts.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
        continue;
      }
      const am = ((i - 0.5) / spokes) * Math.PI * 2 - Math.PI / 2;
      parts.push(
        `Q ${(c + Math.cos(am) * r * 0.82).toFixed(2)} ${(c + Math.sin(am) * r * 0.82).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`,
      );
    }
    return parts.join(" ");
  })();

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <g stroke="var(--gold)" strokeWidth="1.25" strokeLinecap="round" fill="none">
        {Array.from({ length: spokes }, (_, i) => {
          const [x, y] = spoke(i, 13.5);
          return <line key={i} x1={c} y1={c} x2={x} y2={y} opacity="0.75" />;
        })}
        <path d={ring} />
      </g>
      <circle cx={c} cy={c} r="1.9" fill="var(--gold-hot)" />
    </svg>
  );
}
