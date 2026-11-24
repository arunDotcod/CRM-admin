'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, Loader2, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 300;

/**
 * Organization filter: search `/customers?q=` and pick one; the audit API takes the `org-…` ID.
 * `value` = { id, name } | null.
 */
export function OrgPicker({ id, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    const reqId = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(() => {
      api(`/customers?${new URLSearchParams({ q, limit: '8' })}`)
        .then((data) => {
          if (reqId !== requestId.current) return;
          setResults(data?.items ?? []);
          setError(null);
          setActive(0);
        })
        .catch((err) => {
          if (reqId === requestId.current) setError(err.message);
        })
        .finally(() => {
          if (reqId === requestId.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pick = (item) => {
    onChange({ id: item.id, name: item.name });
    setQuery('');
    setOpen(false);
  };

  if (value?.id) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border border-brand/40 bg-brand/5 pl-2.5 pr-1 text-sm">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate" title={value.id}>
          {value.name || value.id}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded p-1 hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Clear organization filter"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const listId = `${id}-results`;
  const showList = open && query.trim().length >= 2;

  return (
    <div className="relative" ref={boxRef}>
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Search organization…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (event.key === 'Enter' && results[active]) {
            event.preventDefault();
            pick(results[active]);
          } else if (event.key === 'Escape') setOpen(false);
        }}
        className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {loading ? <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full min-w-[240px] overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
        >
          {error ? <li className="px-2 py-2 text-destructive">{error}</li> : null}
          {!error && !loading && results.length === 0 ? (
            <li className="px-2 py-2 text-muted-foreground">No organizations match.</li>
          ) : null}
          {results.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(item)}
              onMouseEnter={() => setActive(index)}
              className={cn('cursor-pointer rounded px-2 py-1.5', index === active && 'bg-accent')}
            >
              <span className="block truncate font-medium">{item.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.slug}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
