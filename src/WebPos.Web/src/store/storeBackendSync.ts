import { ApiError, apiClient, setAuthToken } from '../api/apiClient';
import type { BootstrapDataResponse } from '../api/apiTypes';
import { t } from '../i18n';
import type { ActionResult, AppStoreState } from './storeTypes';

type SetStateFn = (patch: Partial<AppStoreState>) => void;
type GetStateFn = () => AppStoreState;

export const EMPTY_PRODUCTION_STATE: Partial<AppStoreState> = {
  companies: [],
  activeCompanyId: '',
  fiscalYears: [],
  activeFiscalYearId: '',
  fiscalPeriods: [],
  storeLocations: [],
  activeStoreId: '',
  posTerminals: [],
  activeTerminalId: '',
  vatRates: [],
  partners: [],
  items: [],
  itemBarcodes: [],
  itemBomLines: [],
  storeItemPrices: [],
  calculations: [],
  priceLevelings: [],
  transfers: [],
  inventoryCounts: [],
  otherWarehouseDocs: [],
  posReceipts: [],
  heldReceipts: [],
  kepLedgerEntries: [],
  auditLog: [],
  currentUserName: '',
  currentUserEmail: '',
};

export function applyBootstrapData(
  setState: SetStateFn,
  data: BootstrapDataResponse
): void {
  const firstCompany = data.companies[0]?.id ?? '';
  const firstFiscalYear = data.fiscalYears[0]?.id ?? '';
  const firstStore = data.storeLocations[0]?.id ?? '';
  const firstTerminal =
    data.posTerminals.find((tr) => tr.storeId === firstStore)?.id ??
    data.posTerminals[0]?.id ??
    '';

  setState({
    companies: data.companies,
    activeCompanyId: firstCompany,
    fiscalYears: data.fiscalYears,
    activeFiscalYearId: firstFiscalYear,
    fiscalPeriods: data.fiscalPeriods,
    storeLocations: data.storeLocations,
    activeStoreId: firstStore,
    posTerminals: data.posTerminals,
    activeTerminalId: firstTerminal,
    vatRates: data.vatRates,
    partners: data.partners,
    items: data.items,
    itemBarcodes: data.itemBarcodes,
    itemBomLines: data.itemBomLines,
    storeItemPrices: data.storeItemPrices,
    calculations: data.calculations,
    priceLevelings: data.priceLevelings,
    transfers: data.transfers,
    inventoryCounts: data.inventoryCounts,
    otherWarehouseDocs: data.otherWarehouseDocs,
    posReceipts: data.posReceipts,
    heldReceipts: [],
    kepLedgerEntries: data.kepLedgerEntries,
    auditLog: data.auditLog,
    systemConfig: data.systemConfig ?? { allowPriceChangeWithoutLeveling: false },
  });
}

export async function initializeBackendSession(
  setState: SetStateFn
): Promise<void> {
  setState({ authStatus: 'CHECKING' });
  try {
    const me = await apiClient.getMe();
    setState({
      backendMode: 'API',
      authStatus: 'AUTHENTICATED',
      currentUserName: me.userName,
      currentUserEmail: me.email,
      currentUserRole: me.role,
      activeTenantId: me.tenantId,
    });
    try {
      const bootstrap = await apiClient.getBootstrapData();
      applyBootstrapData(setState, bootstrap);
    } catch {
      setState({ ...EMPTY_PRODUCTION_STATE });
    }
  } catch (err) {
    if (err instanceof ApiError && !err.isNetworkError) {
      setAuthToken(null);
      setState({
        ...EMPTY_PRODUCTION_STATE,
        backendMode: 'API',
        authStatus: 'UNAUTHENTICATED',
        activeTenantId: null,
      });
      return;
    }
    setState({
      backendMode: 'LOCAL_FALLBACK',
      authStatus: 'AUTHENTICATED',
    });
  }
}

export async function loginWithBackend(
  setState: SetStateFn,
  email: string,
  password: string
): Promise<ActionResult> {
  try {
    const res = await apiClient.login({ email, password });
    setAuthToken(res.token);
    setState({
      backendMode: 'API',
      authStatus: 'AUTHENTICATED',
      currentUserName: res.user.userName,
      currentUserEmail: res.user.email,
      currentUserRole: res.user.role,
      activeTenantId: res.user.tenantId,
    });
    try {
      const bootstrap = await apiClient.getBootstrapData();
      applyBootstrapData(setState, bootstrap);
    } catch {
      setState({ ...EMPTY_PRODUCTION_STATE });
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof ApiError && !err.isNetworkError
        ? err.message || t('auth.invalidCredentials')
        : t('auth.invalidCredentials');
    return { ok: false, error: message };
  }
}

export function logoutFromBackend(getState: GetStateFn, setState: SetStateFn): void {
  setAuthToken(null);
  if (getState().backendMode === 'API') {
    setState({
      ...EMPTY_PRODUCTION_STATE,
      authStatus: 'UNAUTHENTICATED',
      activeTenantId: null,
    });
  }
}

export function syncIfApiMode(
  getState: GetStateFn,
  task: () => Promise<unknown>
): void {
  if (getState().backendMode === 'API') {
    void task().catch(() => undefined);
  }
}
