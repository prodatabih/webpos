import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { useAppStore } from './store/useAppStore';
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
import { SuperAdminTenantsPage } from './pages/admin/SuperAdminTenantsPage';
import { KepLedgerPage } from './pages/reports/KepLedgerPage';
import { AuditLogPage } from './pages/reports/AuditLogPage';
import { DailyTurnoverPage } from './pages/reports/DailyTurnoverPage';
import { StockCardsPage } from './pages/warehouse/StockCardsPage';

export function App() {
  const authStatus = useAppStore((s) => s.authStatus);
  const backendMode = useAppStore((s) => s.backendMode);
  const initializeSession = useAppStore((s) => s.initializeSession);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  if (backendMode === 'API' && authStatus !== 'AUTHENTICATED') {
    return <LoginScreen />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
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
          <Route path="/master/users" element={<UsersPage />} />
          <Route path="/admin/tenants" element={<SuperAdminTenantsPage />} />
          <Route path="/reports/daily-turnover" element={<DailyTurnoverPage />} />
          <Route path="/reports/kep-ledger" element={<KepLedgerPage />} />
          <Route path="/reports/audit-log" element={<AuditLogPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
