import React, { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import { AppLayout } from './layout/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Button } from './components/ui/Button';
import { useAppStore } from './store/useAppStore';
import type { UserRole } from './types/domain';
import { LoginScreen } from './pages/auth/LoginScreen';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { PosTerminalPage } from './pages/pos/PosTerminalPage';
import { PosReceiptsPage } from './pages/pos/PosReceiptsPage';
import { CalculationsPage } from './pages/warehouse/CalculationsPage';
import { PriceLevelingPage } from './pages/warehouse/PriceLevelingPage';
import { TransfersPage } from './pages/warehouse/TransfersPage';
import { InventoryCountPage } from './pages/warehouse/InventoryCountPage';
import { OtherWarehouseDocsPage } from './pages/warehouse/OtherWarehouseDocsPage';
import { ItemsPage } from './pages/master/ItemsPage';
import { PartnersPage } from './pages/master/PartnersPage';
import { OrganizationsPage } from './pages/master/OrganizationsPage';
import { FiscalPeriodsPage } from './pages/master/FiscalPeriodsPage';
import { VatRatesPage } from './pages/master/VatRatesPage';
import { LabelCenterPage } from './pages/master/LabelCenterPage';
import { UsersPage } from './pages/master/UsersPage';
import { TenantSettingsPage } from './pages/master/TenantSettingsPage';
import { SuperAdminTenantsPage } from './pages/admin/SuperAdminTenantsPage';
import { KepLedgerPage } from './pages/reports/KepLedgerPage';
import { AuditLogPage } from './pages/reports/AuditLogPage';
import { DailyTurnoverPage } from './pages/reports/DailyTurnoverPage';
import { StockCardsPage } from './pages/warehouse/StockCardsPage';

function RoleGuard({
  allowed,
  currentRole,
  children,
}: {
  allowed: UserRole[];
  currentRole: UserRole;
  children: React.ReactElement;
}) {
  if (!allowed.includes(currentRole)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export function App() {
  const authStatus = useAppStore((s) => s.authStatus);
  const backendMode = useAppStore((s) => s.backendMode);
  const connectionError = useAppStore((s) => s.connectionError);
  const currentUserRole = useAppStore((s) => s.currentUserRole);
  const activeTenantId = useAppStore((s) => s.activeTenantId);
  const initializeSession = useAppStore((s) => s.initializeSession);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  if (backendMode === 'API' && authStatus !== 'AUTHENTICATED') {
    return (
      <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
        {connectionError && authStatus !== 'CHECKING' && (
          <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-3">
            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-destructive">
                <WifiOff className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Veza sa serverom nije uspostavljena</div>
                  <div>{connectionError}</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void initializeSession()}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Pokušaj ponovo</span>
              </Button>
            </div>
          </div>
        )}
        <div className="flex-1">
          <LoginScreen />
        </div>
      </div>
    );
  }

  const isSuperAdminWithoutTenant = currentUserRole === 'SuperAdmin' && !activeTenantId;

  return (
    <HashRouter>
      <ErrorBoundary>
        <Routes>
          <Route element={<AppLayout />}>
            <Route
              path="/"
              element={
                isSuperAdminWithoutTenant ? (
                  <Navigate to="/admin/tenants" replace />
                ) : (
                  <DashboardPage />
                )
              }
            />
            <Route path="/pos" element={<PosTerminalPage />} />
            <Route path="/pos/receipts" element={<PosReceiptsPage />} />
            <Route path="/warehouse/calculations" element={<CalculationsPage />} />
            <Route path="/warehouse/price-leveling" element={<PriceLevelingPage />} />
            <Route path="/warehouse/transfers" element={<TransfersPage />} />
            <Route path="/warehouse/inventory-count" element={<InventoryCountPage />} />
            <Route path="/warehouse/other-documents" element={<OtherWarehouseDocsPage />} />
            <Route path="/warehouse/stock-cards" element={<StockCardsPage />} />
            <Route path="/master/items" element={<ItemsPage />} />
            <Route path="/master/partners" element={<PartnersPage />} />
            <Route path="/master/organizations" element={<OrganizationsPage />} />
            <Route path="/master/fiscal-periods" element={<FiscalPeriodsPage />} />
            <Route path="/master/vat-rates" element={<VatRatesPage />} />
            <Route path="/master/labels" element={<LabelCenterPage />} />
            <Route
              path="/master/users"
              element={
                <RoleGuard allowed={['TenantAdmin', 'SuperAdmin']} currentRole={currentUserRole}>
                  <UsersPage />
                </RoleGuard>
              }
            />
            <Route
              path="/master/settings"
              element={
                <RoleGuard allowed={['TenantAdmin', 'SuperAdmin']} currentRole={currentUserRole}>
                  <TenantSettingsPage />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/tenants"
              element={
                <RoleGuard allowed={['SuperAdmin']} currentRole={currentUserRole}>
                  <SuperAdminTenantsPage />
                </RoleGuard>
              }
            />
            <Route path="/reports/daily-turnover" element={<DailyTurnoverPage />} />
            <Route path="/reports/kep-ledger" element={<KepLedgerPage />} />
            <Route path="/reports/audit-log" element={<AuditLogPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </HashRouter>
  );
}

export default App;
