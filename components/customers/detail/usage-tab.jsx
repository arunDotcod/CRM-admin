'use client';

/**
 * Usage tab (BO18; api-contracts §12.3 usage). This month vs limits, then the last 6 UTC months:
 * a stacked bar chart of AI replies per channel and a table with every number.
 *
 * Chart colours follow the dataviz reference palette (categorical slots 1–5 in fixed order per
 * channel, validated light: CVD ΔE 9.1, normal ΔE 19.6). Three slots are below 3:1 contrast on
 * white, so the table below is the required relief; legend + per-bar tooltip carry identity.
 */
import { useEffect, useMemo, useState } from 'react';
import { CHANNEL_LABELS, formatNumber } from '@/lib/customers';
import { customerApi, formatMicros, formatMonth } from '@/lib/customer-detail';
import { ErrorState } from '@/components/common/states';
import { Skeleton } from '@/components/ui/skeleton';
import { UsageMeter } from '@/components/customers/usage-meter';
import { Section } from './overview-tab';

const SERIES = [
  { key: 'WHATSAPP', color: '#2a78d6' },
  { key: 'WEBCHAT', color: '#eb6834' },
  { key: 'INSTAGRAM', color: '#1baf7a' },
  { key: 'VOICE', color: '#eda100' },
  { key: 'SANDBOX', color: '#e87ba4' },
];
const LABEL = { ...CHANNEL_LABELS, SANDBOX: 'Test chat' };

function niceMax(value) {
  if (value <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= value) * pow;
  return step;
}

/** Path for a bar segment with only the top corners rounded (data end), anchored to the base. */
function topRounded(x, y, w, h, r) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function RepliesChart({ months, limit }) {
  const [hover, setHover] = useState(null);
  const data = [...months].reverse(); // oldest → newest, left → right
  const present = SERIES.filter((s) => data.some((m) => m.byChannel.some((c) => c.channel === s.key && c.aiReplies > 0)));
  const totals = data.map((m) => m.byChannel.reduce((sum, c) => sum + (c.aiReplies || 0), 0));
  const max = niceMax(Math.max(...totals, typeof limit === 'number' ? limit : 0));
  const W = 560;
  const H = 200;
  const pad = { l: 44, r: 8, t: 10, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / data.length;
  const bw = Math.min(40, slot * 0.55);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];

  if (!present.length)
    return <p className="py-8 text-center text-sm text-muted-foreground">No AI replies in the last {data.length} months.</p>;

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {present.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
            {LABEL[s.key] || s.key}
          </li>
        ))}
        {typeof limit === 'number' ? (
          <li className="inline-flex items-center gap-1.5">
            <span className="w-3 border-t border-dashed border-foreground/60" aria-hidden="true" /> Current limit
          </li>
        ) : null}
      </ul>
      <div className="relative max-w-2xl">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="AI replies per month by channel">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeWidth="1" />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))">
                {t >= 1000 ? `${(t / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k` : t}
              </text>
            </g>
          ))}
          {data.map((m, i) => {
            const cx = pad.l + slot * i + slot / 2;
            let acc = 0;
            const segs = present
              .map((s) => ({ s, v: m.byChannel.find((c) => c.channel === s.key)?.aiReplies || 0 }))
              .filter((seg) => seg.v > 0);
            return (
              <g key={m.month}>
                {segs.map(({ s, v }, j) => {
                  const y0 = y(acc);
                  acc += v;
                  const y1 = y(acc);
                  // 2px surface gap between stacked segments.
                  const h = Math.max(0, y0 - y1 - (j > 0 ? 2 : 0));
                  const top = j === segs.length - 1;
                  return top ? (
                    <path key={s.key} d={topRounded(cx - bw / 2, y1, bw, h, 4)} fill={s.color} />
                  ) : (
                    <rect key={s.key} x={cx - bw / 2} y={y1} width={bw} height={h} fill={s.color} />
                  );
                })}
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
                  {formatMonth(m.month)}
                </text>
                <rect
                  x={pad.l + slot * i}
                  y={pad.t}
                  width={slot}
                  height={ih}
                  fill={hover === i ? 'hsl(var(--muted) / 0.5)' : 'transparent'}
                  style={{ mixBlendMode: 'multiply' }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${formatMonth(m.month)}: ${formatNumber(totals[i])} AI replies`}
                />
              </g>
            );
          })}
          {typeof limit === 'number' && limit <= max ? (
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(limit)}
              y2={y(limit)}
              stroke="hsl(var(--foreground) / 0.6)"
              strokeDasharray="4 3"
              strokeWidth="1"
              pointerEvents="none"
            />
          ) : null}
        </svg>
        {hover != null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[150px] rounded-md border bg-background px-3 py-2 text-xs shadow-md"
            style={{
              left: `${((pad.l + slot * hover + slot / 2) / W) * 100}%`,
              transform: hover > data.length / 2 ? 'translateX(-105%)' : 'translateX(5%)',
            }}
          >
            <p className="mb-1 font-medium">{formatMonth(data[hover].month)}</p>
            {present.map((s) => {
              const v = data[hover].byChannel.find((c) => c.channel === s.key)?.aiReplies || 0;
              return (
                <p key={s.key} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                    {LABEL[s.key] || s.key}
                  </span>
                  <span className="tabular-nums">{formatNumber(v)}</span>
                </p>
              );
            })}
            <p className="mt-1 flex justify-between gap-3 border-t pt-1 font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatNumber(totals[hover])}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UsageTable({ months }) {
  const rows = [];
  for (const m of months) {
    const channels = m.byChannel.length ? m.byChannel : [null];
    channels.forEach((c, i) => {
      rows.push({ m, c, first: i === 0, span: channels.length });
    });
  }
  const thBase = 'whitespace-nowrap px-3 py-2 text-xs font-medium text-muted-foreground';
  const th = `${thBase} text-right`;
  const td = 'px-3 py-2 text-right tabular-nums';
  return (
    <div className="relative -m-4 overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className={`${thBase} text-left`}>Month</th>
            <th className={`${thBase} text-left`}>Channel</th>
            <th className={th}>AI replies</th>
            <th className={th}>Runs</th>
            <th className={th}>Input tokens</th>
            <th className={th}>Output tokens</th>
            <th className={th}>Est. AI cost</th>
            <th className={th}>STT seconds</th>
            <th className={th}>Voice min</th>
            <th className={th}>Calls</th>
            <th className={th}>Voice cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, c, first, span }) => (
            <tr key={`${m.month}-${c?.channel || 'none'}`} className={first ? 'border-t border-border' : ''}>
              {first ? (
                <td rowSpan={span} className="whitespace-nowrap px-3 py-2 align-top font-medium">
                  {formatMonth(m.month)}
                </td>
              ) : null}
              <td className="px-3 py-2">{c ? LABEL[c.channel] || c.channel : <span className="text-muted-foreground">No AI usage</span>}</td>
              <td className={td}>{c ? formatNumber(c.aiReplies) : '—'}</td>
              <td className={td}>{c ? formatNumber(c.runs) : '—'}</td>
              <td className={td}>{c ? formatNumber(c.inputTokens) : '—'}</td>
              <td className={td}>{c ? formatNumber(c.outputTokens) : '—'}</td>
              <td className={td}>{c ? formatMicros(c.estimatedCostMicros) : '—'}</td>
              <td className={td}>{c ? formatNumber(c.sttSeconds) : '—'}</td>
              {first ? (
                <>
                  <td rowSpan={span} className={`${td} align-top`}>{formatNumber(m.voice?.minutes ?? 0)}</td>
                  <td rowSpan={span} className={`${td} align-top`}>{formatNumber(m.voice?.calls ?? 0)}</td>
                  <td rowSpan={span} className={`${td} align-top`}>{formatMicros(m.voice?.providerCostMicros ?? 0)}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UsageTab({ customerId }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    customerApi
      .usage(customerId, 6)
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => {
      alive = false;
    };
  }, [customerId, attempt]);

  const months = useMemo(() => state.data?.months || [], [state.data]);
  if (state.error) return <ErrorState message={state.error.message} onRetry={() => setAttempt((n) => n + 1)} />;
  if (state.loading && !state.data)
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );

  const cm = state.data.currentMonth;
  return (
    <div className="space-y-4">
      <Section title={`This month (${formatMonth(cm.month)}, UTC)`}>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">AI replies</p>
            <UsageMeter used={cm.aiReplies} limit={cm.aiRepliesLimit} className="max-w-xs" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Voice minutes</p>
            <UsageMeter used={cm.voiceMinutes} limit={cm.voiceMinutesLimit} className="max-w-xs" />
          </div>
        </div>
      </Section>
      <Section title="AI replies per channel, last 6 months">
        <RepliesChart months={months} limit={cm.aiRepliesLimit} />
      </Section>
      <Section title="Monthly detail">
        <UsageTable months={months} />
      </Section>
    </div>
  );
}
