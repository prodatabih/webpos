import { ApiError, apiClient, setAuthToken } from '../api/apiClient';
import type { BootstrapDataResponse } from '../api/apiTypes';
import { t } from '../i18n';
import type { ActionResult, AppStoreState } from './storeTypes';

type SetStateFn = (patch: Partial<AppStoreState>) => void;
type GetStateFn = () => AppStoreState;

export const SERVER_UNAVAILABLE_MESSAGE =
  'Server nije dostupan. Provjerite da li je WebPos.WebApi pokrenut.';

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
  labelTemplates: [],
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
  mustChangePassword: false,
};

export function applyBootstrapData(
  getState: GetStateFn,
  setState: SetStateFn,
  data: BootstrapDataResponse
): void {
  const prev = getState();

  const companies = data.companies ?? [];
  const fiscalYears = data.fiscalYears ?? [];
  const storeLocations = data.storeLocations ?? [];
  const posTerminals = data.posTerminals ?? [];

  const activeCompanyId = companies.some((c) => c.id === prev.activeCompanyId)
    ? prev.activeCompanyId
    : (companies[0]?.id ?? '');

  const companyStores = activeCompanyId
    ? storeLocations.filter((s) => s.companyId === activeCompanyId)
    : storeLocations;
  const activeStoreId = storeLocations.some((s) => s.id === prev.activeStoreId)
    ? prev.activeStoreId
    : (companyStores[0]?.id ?? storeLocations[0]?.id ?? '');

  const storeTerminals = activeStoreId
    ? posTerminals.filter((tr) => tr.storeId === activeStoreId)
    : posTerminals;
  const activeTerminalId = posTerminals.some((tr) => tr.id === prev.activeTerminalId)
    ? prev.activeTerminalId
    : (storeTerminals[0]?.id ?? posTerminals[0]?.id ?? '');

  const companyFiscalYears = activeCompanyId
    ? fiscalYears.filter((fy) => fy.companyId === activeCompanyId)
    : fiscalYears;
  const activeFiscalYearId = fiscalYears.some((fy) => fy.id === prev.activeFiscalYearId)
    ? prev.activeFiscalYearId
    : (companyFiscalYears[0]?.id ?? fiscalYears[0]?.id ?? '');

  setState({
    companies,
    activeCompanyId,
    fiscalYears,
    activeFiscalYearId,
    fiscalPeriods: data.fiscalPeriods ?? [],
    storeLocations,
    activeStoreId,
    posTerminals,
    activeTerminalId,
    vatRates: data.vatRates ?? [],
    partners: data.partners ?? [],
    items: data.items ?? [],
    itemBarcodes: data.itemBarcodes ?? [],
    itemBomLines: data.itemBomLines ?? [],
    storeItemPrices: data.storeItemPrices ?? [],
    labelTemplates: data.labelTemplates ?? [],
    calculations: data.calculations ?? [],
    priceLevelings: data.priceLevelings ?? [],
    transfers: data.transfers ?? [],
    inventoryCounts: data.inventoryCounts ?? [],
    otherWarehouseDocs: data.otherWarehouseDocs ?? [],
    posReceipts: data.posReceipts ?? [],
    heldReceipts: prev.heldReceipts,
    kepLedgerEntries: data.kepLedgerEntries ?? [],
    auditLog: data.auditLog ?? [],
    systemConfig: {
      allowPriceChangeWithoutLeveling: data.systemConfig?.allowPriceChangeWithoutLeveling ?? false,
      allowNegativeStock: data.systemConfig?.allowNegativeStock ?? false,
      autoCreatePriceLevelingOnInbound: data.systemConfig?.autoCreatePriceLevelingOnInbound ?? true,
      defaultCurrency: data.systemConfig?.defaultCurrency ?? 'BAM',
    },
  });
}

export async function initializeBackendSession(
  getState: GetStateFn,
  setState: SetStateFn
): Promise<void> {
  setState({ authStatus: 'CHECKING', connectionError: null });
  try {
    const me = await apiClient.getMe();
    setState({
      backendMode: 'API',
      authStatus: 'AUTHENTICATED',
      connectionError: null,
      currentUserName: me.userName,
      currentUserEmail: me.email,
      currentUserRole: me.role,
      activeTenantId: me.tenantId,
      mustChangePassword: Boolean(me.mustChangePassword),
    });
    try {
      const bootstrap = await apiClient.getBootstrapData();
      applyBootstrapData(getState, setState, bootstrap);
    } catch (bootErr) {
      if (bootErr instanceof ApiError && bootErr.isNetworkError) {
        setState({
          ...EMPTY_PRODUCTION_STATE,
          backendMode: 'API',
          authStatus: 'UNAUTHENTICATED',
          activeTenantId: null,
          connectionError: SERVER_UNAVAILABLE_MESSAGE,
        });
      } else {
        setState({
          ...EMPTY_PRODUCTION_STATE,
          currentUserName: me.userName,
          currentUserEmail: me.email,
          mustChangePassword: Boolean(me.mustChangePassword),
        });
      }
    }
  } catch (err) {
    if (err instanceof ApiError && !err.isNetworkError) {
      setAuthToken(null);
      setState({
        ...EMPTY_PRODUCTION_STATE,
        backendMode: 'API',
        authStatus: 'UNAUTHENTICATED',
        activeTenantId: null,
        connectionError: null,
      });
      return;
    }
    setState({
      ...EMPTY_PRODUCTION_STATE,
      backendMode: 'API',
      authStatus: 'UNAUTHENTICATED',
      activeTenantId: null,
      connectionError: SERVER_UNAVAILABLE_MESSAGE,
    });
  }
}

export async function loginWithBackend(
  getState: GetStateFn,
  setState: SetStateFn,
  email: string,
  password: string
): Promise<ActionResult> {
  setState({ connectionError: null });
  try {
    const res = await apiClient.login({ email, password });
    setAuthToken(res.token);
    setState({
      backendMode: 'API',
      authStatus: 'AUTHENTICATED',
      connectionError: null,
      currentUserName: res.user.userName,
      currentUserEmail: res.user.email,
      currentUserRole: res.user.role,
      activeTenantId: res.user.tenantId,
      mustChangePassword: Boolean(res.user.mustChangePassword),
      heldReceipts: [],
    });
    try {
      const bootstrap = await apiClient.getBootstrapData();
      applyBootstrapData(getState, setState, bootstrap);
    } catch (bootErr) {
      const message =
        bootErr instanceof Error && bootErr.message
          ? bootErr.message
          : 'Greška pri učitavanju početnih podataka sa servera.';
      setState({
        ...EMPTY_PRODUCTION_STATE,
        currentUserName: res.user.userName,
        currentUserEmail: res.user.email,
        mustChangePassword: Boolean(res.user.mustChangePassword),
      });
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.isNetworkError) {
      setState({ connectionError: SERVER_UNAVAILABLE_MESSAGE });
      return { ok: false, error: SERVER_UNAVAILABLE_MESSAGE };
    }
    const message =
      err instanceof ApiError && err.message ? err.message : t('auth.invalidCredentials');
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
      connectionError: null,
    });
  }
}

export async function persistIfApiMode<T>(
  getState: GetStateFn,
  task: () => Promise<T>,
  fallbackError = 'Greška pri snimanju na server.'
): Promise<{ ok: true; data?: T } | { ok: false; error: string }> {
  if (getState().backendMode !== 'API') {
    return { ok: true };
  }
  try {
    const data = await task();
    return { ok: true, data };
  } catch (err) {
    const message =
      err instanceof ApiError && err.isNetworkError
        ? SERVER_UNAVAILABLE_MESSAGE
        : err instanceof Error && err.message
          ? err.message
          : fallbackError;
    return { ok: false, error: message };
  }
}
