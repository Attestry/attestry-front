import useAuthStore from '../../store/useAuthStore';
import { normalizeApiErrorMessage } from '../../utils/permissionUi';

const authFetch = async (url, options = {}) => {
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMsg = `API Error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData.message || errorMsg;
    } catch (e) {
      // ignore json parse error
    }
    const error = new Error(normalizeApiErrorMessage(errorMsg, response.status));
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
};

export const listServiceProviders = async (name = '') => {
  const params = new URLSearchParams({
    page: '0',
    size: '100',
  });
  if (name?.trim()) params.set('name', name.trim());
  return authFetch(`/workflows/service/providers?${params.toString()}`);
};

export const getServiceProvider = async (tenantId) =>
  authFetch(`/workflows/service/providers/${encodeURIComponent(tenantId)}`);

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
