'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Download, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { api, apiDownload } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  CHANNEL_LABELS,
  CHANNELS,
  DEFAULT_SORT,
  PAGE_SIZE,
  SORTS,
  STATES,
  VERIFICATIONS,
  activeFilterCount,
  filtersToQuery,
  formatDateTime,
  readFilters,
} from '@/lib/customers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { CustomerTable } from '@/components/customers/customer-table';
import { StatusBadge } from '@/components/customers/status-badge';

const SEARCH_DEBOUNCE_MS = 350;

const selectClass =
  'h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function FilterLabel({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </label>
  );
}

/** Multi-select as toggle chips that reuse the shared status badge colours. */
function ChipGroup({ label, kind, values, selected, onToggle }) {
  return (
    <fieldset>
      <legend className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => {
          const on = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(value)}
              className={cn(
                'rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                on ? 'ring-2 ring-foreground/70 ring-offset-1' : 'opacity-60 hover:opacity-100',
              )}
            >
              <StatusBadge kind={kind} value={value} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A removable chip for filters that only come from links (Home tiles): queue, period end. */
function LinkedFilterChip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-foreground">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function CustomersList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(queryString)), [queryString]);
  const apiQuery = useMemo(() => filtersToQuery(filters), [filters]);

  const [search, setSearch] = useState(filters.q);
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);

  // ---------------------------------------------------------------- URL state

  const navigate = useCallback(
    (next, { replace = false } = {}) => {
      const qs = filtersToQuery(next);
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router],
  );

  const update = useCallback((patch) => navigate({ ...filters, ...patch }), [filters, navigate]);

  // The queue shortcut overrides verification/email on the API; turn it into the plain filters
  // before the user edits one of those so the result matches what the controls show.
  const unfoldQueue = useCallback(
    (patch) => {
      if (!filters.queue) return patch;
      const base = { verification: ['PENDING'], emailConfirmed: filters.queue === 'pending' ? 'true' : 'false' };
      return { queue: '', ...base, ...patch };
    },
    [filters.queue],
  );

  // Keep the search box in sync when the URL changes from outside (back button, sidebar link).
  useEffect(() => {
    setSearch(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (search.trim() === filters.q.trim()) return undefined;
    const timer = setTimeout(() => navigate({ ...filters, q: search }, { replace: true }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, filters, navigate]);

  // ---------------------------------------------------------------- data

  useEffect(() => {
    const id = ++requestId.current;
    setStatus('loading');
    setError(null);
    setMoreError(null);
    const qs = filtersToQuery(filters, { limit: PAGE_SIZE });
    api(`/customers?${qs}`)
      .then((data) => {
        if (id !== requestId.current) return;
        setItems(data?.items ?? []);
        setNextCursor(data?.nextCursor ?? null);
        setStatus('ready');
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(err);
        setStatus('error');
      });
    // `apiQuery` captures every filter; reloadKey forces a retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiQuery, reloadKey]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const qs = filtersToQuery(filters, { limit: PAGE_SIZE, cursor: nextCursor });
      const data = await api(`/customers?${qs}`);
      if (id !== requestId.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...(data?.items ?? []).filter((item) => !seen.has(item.id))];
      });
      setNextCursor(data?.nextCursor ?? null);
    } catch (err) {
      if (id === requestId.current) setMoreError(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const qs = filtersToQuery(filters);
      const name = await apiDownload(`/customers.csv${qs ? `?${qs}` : ''}`, { fallbackName: 'customers.csv' });
      toast.success(`Downloaded ${name}`);
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ---------------------------------------------------------------- render

  const count = activeFilterCount(filters);
  const hasQuery = count > 0 || Boolean(filters.q);
  const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const clearAll = () => {
    setSearch('');
    navigate({ ...readFilters({}), sort: filters.sort });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value.slice(0, 120))}
            placeholder="Search organization, slug, owner name or email"
            aria-label="Search customers"
            className="bg-background pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Sort"
            value={filters.sort || DEFAULT_SORT}
            onChange={(event) => update({ sort: event.target.value === DEFAULT_SORT ? '' : event.target.value })}
            className={cn(selectClass, 'min-w-0 flex-1 sm:flex-none')}
          >
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="customer-filters"
            className="lg:hidden"
          >
            <SlidersHorizontal /> Filters{count ? ` (${count})` : ''}
          </Button>
          <Button type="button" variant="outline" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div
        id="customer-filters"
        className={cn('rounded-xl border border-border bg-background p-3 sm:p-4', filtersOpen ? 'block' : 'hidden lg:block')}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
          <ChipGroup
            label="Verification"
            kind="verification"
            values={VERIFICATIONS}
            selected={filters.queue ? ['PENDING'] : filters.verification}
            onToggle={(value) => {
              const current = filters.queue ? ['PENDING'] : filters.verification;
              update(unfoldQueue({ verification: toggle(current, value) }));
            }}
          />
          <ChipGroup
            label="State"
            kind="state"
            values={STATES}
            selected={filters.state}
            onToggle={(value) => update({ state: toggle(filters.state, value) })}
          />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <FilterLabel htmlFor="f-email">Owner email</FilterLabel>
              <select
                id="f-email"
                className={cn(selectClass, 'w-full')}
                value={filters.queue ? (filters.queue === 'pending' ? 'true' : 'false') : filters.emailConfirmed}
                onChange={(event) => update(unfoldQueue({ emailConfirmed: event.target.value }))}
              >
                <option value="">Any</option>
                <option value="true">Confirmed</option>
                <option value="false">Unconfirmed</option>
              </select>
            </div>
            <div>
              <FilterLabel htmlFor="f-channel">Channel connected</FilterLabel>
              <select
                id="f-channel"
                className={cn(selectClass, 'w-full')}
                value={filters.channel}
                onChange={(event) => update({ channel: event.target.value })}
              >
                <option value="">Any</option>
                {CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {CHANNEL_LABELS[channel]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FilterLabel htmlFor="f-source">Created by</FilterLabel>
              <select
                id="f-source"
                className={cn(selectClass, 'w-full')}
                value={filters.source}
                onChange={(event) => update({ source: event.target.value })}
              >
                <option value="">Anyone</option>
                <option value="self_serve">Self-serve signup</option>
                <option value="staff">Dotcod staff</option>
              </select>
            </div>
            <div>
              <FilterLabel htmlFor="f-from">Signed up from</FilterLabel>
              <Input
                id="f-from"
                type="date"
                value={filters.signupFrom}
                max={filters.signupTo || undefined}
                onChange={(event) => update({ signupFrom: event.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <FilterLabel htmlFor="f-to">Signed up to</FilterLabel>
              <Input
                id="f-to"
                type="date"
                value={filters.signupTo}
                min={filters.signupFrom || undefined}
                onChange={(event) => update({ signupTo: event.target.value })}
                className="bg-background"
              />
            </div>
          </div>
        </div>
        {filters.queue || filters.periodEndsBefore || hasQuery ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {filters.queue === 'pending' ? (
              <LinkedFilterChip onRemove={() => update({ queue: '' })}>Pending queue (email confirmed)</LinkedFilterChip>
            ) : null}
            {filters.queue === 'unconfirmed' ? (
              <LinkedFilterChip onRemove={() => update({ queue: '' })}>Unconfirmed signups</LinkedFilterChip>
            ) : null}
            {filters.periodEndsBefore ? (
              <LinkedFilterChip onRemove={() => update({ periodEndsBefore: '' })}>
                Period ends before {formatDateTime(filters.periodEndsBefore)}
              </LinkedFilterChip>
            ) : null}
            {hasQuery ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2 text-xs">
                <X /> Clear all
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Results */}
      {status === 'loading' ? (
        <TableSkeleton rows={8} cols={8} />
      ) : status === 'error' ? (
        <ErrorState message={error?.message} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={hasQuery ? 'No customers match' : 'No customers yet'}
          description={
            hasQuery
              ? 'Try a different search or clear some filters.'
              : 'Organizations appear here when someone signs up or staff create one.'
          }
          action={
            hasQuery ? (
              <Button variant="outline" onClick={clearAll}>
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <CustomerTable
          items={items}
          footer={
            <div className="flex flex-col items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground sm:flex-row">
              <span aria-live="polite">
                Showing {items.length.toLocaleString('en-IN')}
                {nextCursor ? '' : items.length === 1 ? ' customer' : ' customers'}
                {nextCursor ? ', more available' : ''}
              </span>
              {moreError ? <span className="text-destructive">{moreError.message}</span> : null}
              {nextCursor ? (
                <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="animate-spin" /> : null}
                  {moreError ? 'Try again' : 'Load more'}
                </Button>
              ) : null}
            </div>
          }
        />
      )}
    </div>
  );
}

