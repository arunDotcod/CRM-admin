'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ScrollText, SlidersHorizontal, X } from 'lucide-react';
import { api } from '@/lib/api';
import { STAFF_PERMISSIONS, useAuth } from '@/lib/auth';
import {
  ACTION_GROUPS,
  AUDIT_PAGE_SIZE,
  activeAuditFilterCount,
  actionOptionLabel,
  auditFiltersToApi,
  auditFiltersToUrl,
  readAuditFilters,
} from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { AuditTable } from '@/components/audit/audit-table';
import { OrgPicker } from '@/components/audit/org-picker';

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function FilterLabel({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </label>
  );
}

/** BO19 Audit log (`admin.audit.read`; api-contracts §12.8). Filters live in the URL. */
export function AuditLog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const filters = useMemo(() => readAuditFilters(new URLSearchParams(queryString)), [queryString]);
  const apiQuery = useMemo(() => auditFiltersToApi(filters), [filters]);
  const { can } = useAuth();
  const canListStaff = can(STAFF_PERMISSIONS.STAFF_MANAGE);

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Staff filter options: the full list for SUPER_ADMIN, else the names seen in rows.
  const [staffNames, setStaffNames] = useState({});
  const requestId = useRef(0);

  const navigate = useCallback(
    (next) => {
      const qs = auditFiltersToUrl(next);
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );
  const update = useCallback((patch) => navigate({ ...filters, ...patch }), [filters, navigate]);

  const rememberStaff = useCallback((rows) => {
    setStaffNames((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of rows) {
        const staff = row?.staff ?? row;
        if (staff?.id && staff.name && next[staff.id] !== staff.name) {
          next[staff.id] = staff.name;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    if (!canListStaff) return;
    api('/staff')
      .then((data) => rememberStaff(data?.items ?? []))
      .catch(() => {});
  }, [canListStaff, rememberStaff]);

  useEffect(() => {
    const id = ++requestId.current;
    setStatus('loading');
    setError(null);
    setMoreError(null);
    api(`/audit?${auditFiltersToApi(filters, { limit: AUDIT_PAGE_SIZE })}`)
      .then((data) => {
        if (id !== requestId.current) return;
        const rows = data?.items ?? [];
        setItems(rows);
        setNextCursor(data?.nextCursor ?? null);
        rememberStaff(rows);
        setStatus('ready');
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(err);
        setStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiQuery, reloadKey]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const data = await api(`/audit?${auditFiltersToApi(filters, { limit: AUDIT_PAGE_SIZE, cursor: nextCursor })}`);
      if (id !== requestId.current) return;
      const rows = data?.items ?? [];
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...rows.filter((item) => !seen.has(item.id))];
      });
      rememberStaff(rows);
      setNextCursor(data?.nextCursor ?? null);
    } catch (err) {
      if (id === requestId.current) setMoreError(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const staffOptions = useMemo(
    () => Object.entries(staffNames).sort((a, b) => a[1].localeCompare(b[1])),
    [staffNames],
  );
  const knownAction = ACTION_GROUPS.some((group) => group.options.some((option) => option.value === filters.action));
  const filterCount = activeAuditFilterCount(filters);
  const dateError = filters.from && filters.to && filters.from > filters.to;

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        className="w-full justify-between md:hidden"
        aria-expanded={filtersOpen}
        aria-controls="audit-filters"
        onClick={() => setFiltersOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal /> Filters{filterCount ? ` (${filterCount})` : ''}
        </span>
        <span className="text-xs text-muted-foreground">{filtersOpen ? 'Hide' : 'Show'}</span>
      </Button>
      <div
        id="audit-filters"
        className={cn(
          'gap-3 rounded-xl border bg-background p-3 sm:grid-cols-2 md:grid xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.6fr)_auto]',
          filtersOpen ? 'grid' : 'hidden',
        )}
      >
        <div>
          <FilterLabel htmlFor="audit-staff">Staff</FilterLabel>
          <select
            id="audit-staff"
            className={selectClass}
            value={filters.staff}
            onChange={(event) => update({ staff: event.target.value })}
          >
            <option value="">All staff</option>
            {filters.staff && !staffNames[filters.staff] ? <option value={filters.staff}>{filters.staff}</option> : null}
            {staffOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FilterLabel htmlFor="audit-org">Organization</FilterLabel>
          <OrgPicker
            id="audit-org"
            value={filters.organization ? { id: filters.organization, name: filters.orgName } : null}
            onChange={(org) => update({ organization: org?.id || '', orgName: org?.name || '' })}
          />
        </div>
        <div>
          <FilterLabel htmlFor="audit-action">Action</FilterLabel>
          <select
            id="audit-action"
            className={selectClass}
            value={filters.action}
            onChange={(event) => update({ action: event.target.value })}
          >
            <option value="">All actions</option>
            {filters.action && !knownAction ? <option value={filters.action}>Starts with “{filters.action}”</option> : null}
            {ACTION_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {actionOptionLabel(option)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <FilterLabel htmlFor="audit-from">Date range</FilterLabel>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
            <input
              id="audit-from"
              type="date"
              aria-label="From date"
              className={selectClass}
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => update({ from: event.target.value })}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              aria-label="To date"
              className={selectClass}
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => update({ to: event.target.value })}
            />
          </div>
        </div>
        <div className="flex items-end">
          <Button
            variant="ghost"
            className="w-full xl:w-auto"
            disabled={!filterCount}
            onClick={() => navigate({ staff: '', organization: '', orgName: '', action: '', from: '', to: '' })}
          >
            <X /> Clear{filterCount ? ` (${filterCount})` : ''}
          </Button>
        </div>
      </div>

      {dateError ? <p className="text-sm text-destructive">The start date is after the end date, so nothing matches.</p> : null}

      {status === 'loading' ? <TableSkeleton rows={8} cols={6} /> : null}
      {status === 'error' ? <ErrorState message={error?.message} onRetry={() => setReloadKey((k) => k + 1)} /> : null}
      {status === 'ready' && items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filterCount ? 'No actions match these filters' : 'No staff actions yet'}
          description={filterCount ? 'Try a wider date range or clear a filter.' : 'Every staff write and sign-in shows up here.'}
        />
      ) : null}
      {status === 'ready' && items.length > 0 ? (
        <>
          <AuditTable
            items={items}
            onFilter={(patch, staff) => {
              if (staff) rememberStaff([staff]);
              update(patch);
            }}
          />
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-xs text-muted-foreground">
              Showing {items.length}
              {nextCursor ? ', more available' : ''} · newest first
            </p>
            {moreError ? <p className="text-sm text-destructive">{moreError.message}</p> : null}
            {nextCursor ? (
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="animate-spin" /> : null} Load more
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
