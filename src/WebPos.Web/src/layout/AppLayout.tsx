import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Menu, Moon, Search, Store, Sun, UserCheck, Wifi, WifiOff,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { t } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ToastViewport } from '../components/ui/Toast';
import { LoginDialog } from '../pages/auth/LoginDialog';
import { NAV_GROUPS, NAV_ITEMS } from './navConfig';
import { CommandPalette } from './CommandPalette';

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  const {
    companies, activeCompanyId, setActiveCompanyId,
    storeLocations, activeStoreId, setActiveStoreId,
    fiscalYears, activeFiscalYearId, setActiveFiscalYearId,
    storeItemPrices, theme, toggleTheme, isOnline, setIsOnline,
    currentUserName, currentUserRole, activeTenantId,
  } = useAppStore();

  const hasTenantContext = currentUserRole !== 'SuperAdmin' || Boolean(activeTenantId);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!hasTenantContext) {
      return Boolean(item.roles?.includes('SuperAdmin'));
    }
    return !item.roles || item.roles.includes(currentUserRole);
  });

  const activeItem =
    visibleNavItems.find((item) =>
      item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
    ) ?? visibleNavItems[0];

  const labelQueueCount = storeItemPrices.filter(
    (p) => p.storeId === activeStoreId && p.needsLabelPrint
  ).length;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-150 shrink-0 print:hidden',
          sidebarCollapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className="flex h-13 items-center justify-between border-b border-sidebar-border px-3.5 shrink-0">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs">
              WP
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold tracking-tight truncate">{t('app.name')}</span>
                <span className="text-[10px] text-muted-foreground truncate">{t('app.subtitle')}</span>
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? t('app.expandSidebar') : t('app.collapseSidebar')}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {NAV_GROUPS.map((groupKey) => {
            const groupItems = visibleNavItems.filter((i) => i.groupKey === groupKey);
            if (groupItems.length === 0) return null;
            return (
              <div key={groupKey} className="space-y-0.5">
                {!sidebarCollapsed && (
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t(groupKey)}
                  </div>
                )}
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      end={item.path === '/'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-between gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-2xs'
                            : 'text-sidebar-foreground hover:bg-accent hover:text-accent-foreground',
                          sidebarCollapsed && 'justify-center px-0'
                        )
                      }
                      title={t(item.labelKey)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="h-4 w-4 shrink-0" />
                        {!sidebarCollapsed && <span className="truncate">{t(item.labelKey)}</span>}
                      </div>
                      {!sidebarCollapsed && item.id === 'labels' && labelQueueCount > 0 && (
                        <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                          {labelQueueCount}
                        </Badge>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 text-xs flex items-center justify-between gap-2">
          {!sidebarCollapsed && <span className="truncate font-medium text-foreground">{currentUserName}</span>}
          <button
            type="button"
            onClick={() => setIsOnline(!isOnline)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            title={isOnline ? t('app.online') : t('app.offline')}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5 text-success" /> : <WifiOff className="h-3.5 w-3.5 text-warning" />}
            {!sidebarCollapsed && <span>{isOnline ? t('app.online') : t('app.offline')}</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <header className="flex h-13 items-center justify-between gap-3 border-b border-border bg-card px-4 shrink-0 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen((p) => !p)}>
              <Menu className="h-4 w-4" />
            </Button>
            {activeItem && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <span>{t(activeItem.groupKey)}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold text-foreground truncate">{t(activeItem.labelKey)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">{t('app.commandPaletteHint')}</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                {t('app.shortcutCtrlK')}
              </kbd>
            </button>

            {hasTenantContext && (
              <div className="flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
                <select
                  aria-label={t('app.company')}
                  value={activeCompanyId}
                  onChange={(e) => setActiveCompanyId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">-- Odaberi preduzeće --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  aria-label={t('app.storeLocation')}
                  value={activeStoreId}
                  onChange={(e) => setActiveStoreId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">-- Odaberi poslovnicu --</option>
                  {storeLocations.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                  ))}
                </select>

                <select
                  aria-label={t('app.fiscalYear')}
                  value={activeFiscalYearId}
                  onChange={(e) => setActiveFiscalYearId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">-- Odaberi fiskalnu godinu --</option>
                  {fiscalYears.map((fy) => (
                    <option key={fy.id} value={fy.id}>
                      {fy.year} {fy.isLocked ? `(${t('status.LOCKED')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={() => setLoginDialogOpen(true)}>
              <UserCheck className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{currentUserName}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? t('app.darkTheme') : t('app.lightTheme')}
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="md:hidden border-b border-border bg-card p-3 space-y-1 max-h-72 overflow-y-auto">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </div>
        )}

        <main className="flex-1 overflow-y-auto">{children ?? <Outlet />}</main>
      </div>

      <div className="print:hidden">
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <LoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />
        <ToastViewport />
      </div>
    </div>
  );
}
