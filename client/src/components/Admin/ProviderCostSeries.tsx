// Vermeer: Analytics "cost by provider over time" — stacked bars, day on X, usd_proxy on Y.
// Vermeer: additive, SVG custom (no chart lib), styled to match ModelMixSection tokens.
// Vermeer: driven by its OWN local PeriodSelector (independent of the top filter, no "Overall");
// Vermeer: the page BU still flows in via the `bu` prop. "All providers" -> segments = providers (summed
// Vermeer: per provider/day). A selected provider -> rows filtered, segments = that provider's models.
// Vermeer: usd_proxy is a PROXY on the Vermeer rate table (abs(tokenValue)/1e6), NOT the invoice.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@librechat/client';
import type {
  AnalyticsQueryParams,
  AnalyticsPeriod,
  ProviderCostRow,
} from 'librechat-data-provider';
import { useAdminCostByProviderQuery } from '~/data-provider';
import PeriodSelector from './PeriodSelector';
import { useLocalize } from '~/hooks';

// Vermeer: stable colors for the provider view (Anthropic / Google / OpenAI / Other).
const PROVIDER_PALETTE: Record<string, string> = {
  Anthropic: '#E5384A',
  Google: '#3B82F6',
  OpenAI: '#10B981',
  Other: '#9CA3AF',
};
const PROVIDER_FALLBACK_COLOR = '#9CA3AF';
// Vermeer: mirrors MODEL_PALETTE in Usage.tsx (l.207) for color coherence with the donut — kept local
// Vermeer: to avoid modifying Usage.tsx (MODEL_PALETTE is not exported).
const MODEL_PALETTE = ['#E5384A', '#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6'];
// Vermeer: preferred stack/legend ordering; unknown providers fall back to alpha order.
const PROVIDER_ORDER = ['Anthropic', 'Google', 'OpenAI', 'Other'];

const ALL = 'all';

// Vermeer: default local period for the graph = current month (label resolved by PeriodSelector).
const CURRENT_MONTH_PERIOD: AnalyticsPeriod = {
  key: 'current-month',
  label: '',
  start: null,
  end: null,
};

/** Vermeer: current UTC month as 'YYYY-MM'. */
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Vermeer: chart geometry in px (measured container width drives responsiveness).
const CHART_H = 240;
const PAD_L = 52;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 28;
const Y_TICKS = 4;
const BAR_RATIO = 0.68;
const SEG_GAP = 1;
const BAR_RX = 2;
const X_LABEL_TARGET = 8;

/** Vermeer: usd_proxy is already in USD (backend divided by 1e6) — do NOT reuse formatUSD (it divides again). */
const formatUsdProxy = (value: number): string => `$${value.toFixed(2)}`;

function providerOrderIndex(provider: string): number {
  const index = PROVIDER_ORDER.indexOf(provider);
  return index === -1 ? PROVIDER_ORDER.length : index;
}

/** Vermeer: 'YYYY-MM' -> { start: 1st (incl.), end: 1st of next month (excl.) }, both UTC YYYY-MM-DD. */
function monthRange(monthKey: string): { start: string; end: string } {
  const [year, month] = monthKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  const end = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
  return { start: `${monthKey}-01`, end };
}

/** Vermeer: measures a container's width and keeps it in sync via ResizeObserver. */
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

interface ChartSegment {
  key: string;
  usd: number;
  color: string;
}
interface DayColumn {
  date: string;
  total: number;
  segments: ChartSegment[];
}
interface ChartModel {
  seriesKeys: string[];
  colorByKey: Map<string, string>;
  totalByKey: Map<string, number>;
  columns: DayColumn[];
  maxTotal: number;
  viewTotal: number;
}

/**
 * Vermeer: folds rows into stacked columns. "All" view keys by provider (models summed);
 * a selected provider keys by model. Colors: provider palette (all) or MODEL_PALETTE (models).
 */
function buildChart(rows: ProviderCostRow[], selectedProvider: string): ChartModel {
  const viewingAll = selectedProvider === ALL;
  const relevant = viewingAll ? rows : rows.filter((row) => row.provider === selectedProvider);
  const keyOf = (row: ProviderCostRow): string => (viewingAll ? row.provider : row.model);

  const days = [...new Set(relevant.map((row) => row.date))].sort();
  const keys = [...new Set(relevant.map(keyOf))];
  const seriesKeys = viewingAll
    ? keys.sort((a, b) => providerOrderIndex(a) - providerOrderIndex(b) || a.localeCompare(b))
    : keys.sort((a, b) => a.localeCompare(b));

  const colorByKey = new Map<string, string>();
  seriesKeys.forEach((key, index) => {
    const color = viewingAll
      ? (PROVIDER_PALETTE[key] ?? PROVIDER_FALLBACK_COLOR)
      : MODEL_PALETTE[index % MODEL_PALETTE.length];
    colorByKey.set(key, color);
  });

  const byDay = new Map<string, Map<string, number>>();
  const totalByKey = new Map<string, number>();
  for (const row of relevant) {
    const key = keyOf(row);
    if (!byDay.has(row.date)) {
      byDay.set(row.date, new Map());
    }
    const dayMap = byDay.get(row.date) as Map<string, number>;
    dayMap.set(key, (dayMap.get(key) ?? 0) + row.usd_proxy);
    totalByKey.set(key, (totalByKey.get(key) ?? 0) + row.usd_proxy);
  }

  const columns: DayColumn[] = days.map((date) => {
    const dayMap = byDay.get(date) ?? new Map<string, number>();
    const segments = seriesKeys
      .filter((key) => (dayMap.get(key) ?? 0) > 0)
      .map((key) => ({
        key,
        usd: dayMap.get(key) ?? 0,
        color: colorByKey.get(key) ?? PROVIDER_FALLBACK_COLOR,
      }));
    const total = segments.reduce((sum, seg) => sum + seg.usd, 0);
    return { date, total, segments };
  });

  const maxTotal = columns.reduce((max, col) => Math.max(max, col.total), 0);
  const viewTotal = columns.reduce((sum, col) => sum + col.total, 0);
  return { seriesKeys, colorByKey, totalByKey, columns, maxTotal, viewTotal };
}

interface TooltipState {
  left: number;
  top: number;
  label: string;
  date: string;
  usd: number;
}

function StackedBars({
  chart,
  width,
  onSelectKey,
}: {
  chart: ChartModel;
  width: number;
  onSelectKey?: (key: string) => void;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const { columns, maxTotal } = chart;

  const chartWidth = width > 0 ? width : 640;
  const plotW = Math.max(chartWidth - PAD_L - PAD_R, 10);
  const plotH = CHART_H - PAD_T - PAD_B;
  const baseline = PAD_T + plotH;
  const slot = plotW / Math.max(columns.length, 1);
  const barW = Math.max(slot * BAR_RATIO, 1);
  const scale = maxTotal > 0 ? plotH / maxTotal : 0;
  const labelStep = Math.max(1, Math.ceil(columns.length / X_LABEL_TARGET));
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => (maxTotal / Y_TICKS) * i);

  return (
    <div className="relative w-full">
      <svg
        width={chartWidth}
        height={CHART_H}
        role="img"
        onMouseLeave={() => setTooltip(null)}
        className="text-text-tertiary"
      >
        {yTicks.map((tickValue, i) => {
          const y = baseline - tickValue * scale;
          return (
            <g key={`tick-${i}`}>
              <line
                x1={PAD_L}
                y1={y}
                x2={chartWidth - PAD_R}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                opacity={0.18}
              />
              <text x={PAD_L - 8} y={y + 3} textAnchor="end" fontSize={10} fill="currentColor">
                {formatUsdProxy(tickValue)}
              </text>
            </g>
          );
        })}
        {columns.map((col, colIndex) => {
          const xLeft = PAD_L + colIndex * slot + (slot - barW) / 2;
          let cursorY = baseline;
          return (
            <g key={col.date}>
              {col.segments.map((seg, segIndex) => {
                const h = seg.usd * scale;
                const top = cursorY - h;
                cursorY = top;
                const isTop = segIndex === col.segments.length - 1;
                return (
                  <rect
                    key={seg.key}
                    x={xLeft}
                    y={top}
                    width={barW}
                    height={Math.max(h - SEG_GAP, 0.5)}
                    rx={isTop ? BAR_RX : 0}
                    fill={seg.color}
                    onClick={onSelectKey ? () => onSelectKey(seg.key) : undefined}
                    onMouseEnter={() =>
                      setTooltip({
                        left: xLeft + barW / 2,
                        top: top - 6,
                        label: seg.key,
                        date: col.date,
                        usd: seg.usd,
                      })
                    }
                    style={onSelectKey ? { cursor: 'pointer' } : undefined}
                  />
                );
              })}
              {colIndex % labelStep === 0 && (
                <text
                  x={xLeft + barW / 2}
                  y={baseline + 15}
                  textAnchor="middle"
                  fontSize={10}
                  fill="currentColor"
                >
                  {col.date.slice(8)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border-medium bg-surface-primary px-2 py-1 text-xs text-text-primary shadow-md"
          style={{ left: tooltip.left, top: tooltip.top, transform: 'translate(-50%, -100%)' }}
        >
          <div className="text-text-secondary">{tooltip.date}</div>
          <div className="font-medium">{tooltip.label}</div>
          <div className="tabular-nums">{formatUsdProxy(tooltip.usd)}</div>
        </div>
      )}
    </div>
  );
}

/** Vermeer: cost-by-provider stacked time series. `bu` follows the page; the period is local. */
function ProviderCostSeries({ bu }: Pick<AnalyticsQueryParams, 'bu'>) {
  const localize = useLocalize();
  const [period, setPeriod] = useState<AnalyticsPeriod>(CURRENT_MONTH_PERIOD);
  const [selectedProvider, setSelectedProvider] = useState<string>(ALL);
  const { ref, width } = useMeasuredWidth();

  // Vermeer: derive the daily window from the local period — a month option already carries
  // start/end; "current month" (open-ended) resolves to the current month's window.
  const { start, end } = useMemo(
    () =>
      period.start && period.end
        ? { start: period.start, end: period.end }
        : monthRange(currentMonthKey()),
    [period],
  );
  const { data, isLoading, isError } = useAdminCostByProviderQuery({ bu, start, end });
  const rows = data?.rows ?? [];

  const providers = useMemo(() => {
    const set = new Set(rows.map((row) => row.provider));
    return [...set].sort(
      (a, b) => providerOrderIndex(a) - providerOrderIndex(b) || a.localeCompare(b),
    );
  }, [rows]);

  // Vermeer: fall back to "all" if the drilled provider has no rows in the selected month.
  const effectiveProvider =
    selectedProvider !== ALL && !providers.includes(selectedProvider) ? ALL : selectedProvider;
  const viewingAll = effectiveProvider === ALL;

  const chart = useMemo(() => buildChart(rows, effectiveProvider), [rows, effectiveProvider]);
  const isEmpty = rows.length === 0 || chart.maxTotal <= 0;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {localize('com_usage_provider_title')}
          </h2>
          <p className="text-xs text-text-tertiary">{localize('com_usage_provider_proxy_note')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Vermeer: twin of the top filter, but no "Overall" (daily bars need a bounded month). */}
          <PeriodSelector value={period} onChange={setPeriod} hideOverall />
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            {localize('com_usage_provider_filter_label')}
            <select
              value={effectiveProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="rounded-md border border-border-light bg-surface-secondary px-2 py-1 text-sm text-text-primary"
            >
              <option value={ALL}>{localize('com_usage_provider_filter_all')}</option>
              {providers.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex w-full items-center justify-center py-12 text-text-secondary">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-border-light p-8 text-center text-text-secondary">
          {localize('com_usage_provider_error')}
        </div>
      ) : isEmpty ? (
        <div className="rounded-lg border border-border-light p-8 text-center text-text-secondary">
          {localize('com_usage_provider_empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-2xl font-semibold tabular-nums text-text-primary">
                {formatUsdProxy(chart.viewTotal)}
              </div>
              <div className="text-xs text-text-tertiary">
                {localize('com_usage_provider_total')}
              </div>
            </div>
            <p className="text-xs text-text-tertiary">{localize('com_usage_provider_axis_usd')}</p>
          </div>

          <div ref={ref} className="w-full">
            <StackedBars
              chart={chart}
              width={width}
              onSelectKey={viewingAll ? (key) => setSelectedProvider(key) : undefined}
            />
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {chart.seriesKeys.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors ${
                    viewingAll
                      ? 'border-border-light hover:bg-surface-secondary'
                      : 'cursor-default border-transparent'
                  }`}
                  onClick={viewingAll ? () => setSelectedProvider(key) : undefined}
                  disabled={!viewingAll}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: chart.colorByKey.get(key) ?? PROVIDER_FALLBACK_COLOR,
                    }}
                  />
                  <span className="max-w-[12rem] truncate text-text-primary" title={key}>
                    {key}
                  </span>
                  <span className="tabular-nums text-text-secondary">
                    {formatUsdProxy(chart.totalByKey.get(key) ?? 0)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default ProviderCostSeries;
