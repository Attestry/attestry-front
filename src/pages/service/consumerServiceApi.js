import useAuthStore from '../../store/useAuthStore';
import { apiFetchJson } from '../../utils/api';
import { normalizeApiErrorMessage } from '../../utils/permissionUi';

const authFetch = async (url, options = {}) => {
  const token = useAuthStore.getState().accessToken;
  return apiFetchJson(url, options, { token, fallbackMessage: normalizeApiErrorMessage('', undefined) });
};

export const listServiceProviders = async (name = '') => {
  const params = new URLSearchParams({
    page: '0',
    size: '100',
    type: 'SERVICE',
    status: 'ACTIVE',
  });
  if (name?.trim()) params.set('name', name.trim());
  const data = await authFetch(`/tenants?${params.toString()}`);
  return {
    ...data,
    content: Array.isArray(data?.items) ? data.items : [],
  };
};

export const getServiceProvider = async (tenantId) =>
  authFetch(`/tenants/${encodeURIComponent(tenantId)}`);

export const listMyPassports = async () => authFetch('/products/me/passports');

export const submitServiceRequest = async (passportId, providerTenantId, payload = {}) =>
  authFetch(`/workflows/passports/${encodeURIComponent(passportId)}/service-consent`, {
    method: 'POST',
    body: JSON.stringify({
      providerTenantId,
      beforeEvidenceGroupId: payload.beforeEvidenceGroupId || null,
      serviceRequestMethod: payload.serviceRequestMethod || null,
      symptomDescription: payload.symptomDescription || null,
      requestedReservationAt: payload.requestedReservationAt || null,
      contactMemo: payload.contactMemo || null,
    }),
  });

export const listMyServiceRequests = async (status = '', page = 0, size = 20) => {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (status) params.set('status', status);
  return authFetch(`/workflows/service-requests/me?${params.toString()}`);
};

export const cancelMyServiceRequest = async (serviceRequestId, cancelReason) =>
  authFetch(`/workflows/service-requests/${encodeURIComponent(serviceRequestId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ cancelReason }),
  });

export const presignOwnerServiceEvidence = async (payload) =>
  authFetch('/workflows/service-requests/evidences/presign', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const completeOwnerServiceEvidence = async (payload) =>
  authFetch('/workflows/service-requests/evidences/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
