'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronsUpDown, LogOut, Menu, X } from 'lucide-react';
import { AdminBadge } from '@/components/shell/admin-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROLE_LABELS, useAuth } from '@/lib/auth';
import { NAV_ITEMS, isActive } from '@/lib/nav';
import { cn } from '@/lib/utils';

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function SidebarNav({ onNavigate }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const items = NAV_ITEMS.filter((item) => can(item.permission));
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const active = isActive(item, pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className={cn('h-4 w-4', active ? 'text-sidebar-primary' : '')} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const router = useRouter();
  const { staff, role, logout } = useAuth();
  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Account menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              {initials(staff?.name)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-sidebar-accent-foreground">{staff?.name}</span>
            <span className="block truncate text-xs text-sidebar-foreground">{ROLE_LABELS[role] || role}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{staff?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{staff?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarContent({ onNavigate }) {
  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar py-5">
      <div className="px-5">
        <AdminBadge />
      </div>
      <SidebarNav onNavigate={onNavigate} />
      <div className="border-t border-sidebar-border px-3 pt-3">
        <UserMenu />
      </div>
    </div>
  );
}

export function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close navigation' : 'Open navigation'}
          >
            {open ? <X /> : <Menu />}
          </Button>
          <Badge className="border-transparent bg-brand/10 text-brand hover:bg-brand/10">Dotcod Admin</Badge>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Staff back office: changes here affect live customer accounts.
          </span>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
