import useAuthStore from '../../store/useAuthStore';
import { apiFetchJson } from '../../utils/api';
import { normalizeApiErrorMessage } from '../../utils/permissionUi';
import { getCurrentMembership, hasEffectiveScope } from '../../utils/permissionUi';
import {
  SERVICE_REQUEST_METHOD_OPTIONS,
  SERVICE_TYPE_OPTIONS,
  getServiceRequestMethodLabel,
  getServiceTypeLabel,
} from './serviceOptions';

export const SERVICE_STATUS_META = {
  PENDING: { label: '대기중', badge: 'bg-amber-50 text-amber-700 border-amber-100' },
  ACCEPTED: { label: '진행중', badge: 'bg-blue-50 text-blue-700 border-blue-100' },
  COMPLETED: { label: '완료', badge: 'bg-green-50 text-green-700 border-green-100' },
  REJECTED: { label: '반려', badge: 'bg-rose-50 text-rose-700 border-rose-100' },
  CANCELLED: { label: '취소', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const SERVICE_PERMISSION_GUIDE =
  '현재 계정은 서비스 처리 권한이 없어 이 기능을 사용할 수 없습니다. 서비스 처리 권한이 있는 멤버에게 요청해주세요.';

export const SERVICE_VIEW_PERMISSION_GUIDE =
  '현재 계정은 서비스 요청 조회 권한이 없어 목록을 볼 수 없습니다.';

export const hasServiceViewPermission = (memberships = [], tenantId) => {
  const currentMembership = getCurrentMembership(memberships, tenantId, 'SERVICE');
  return hasEffectiveScope(currentMembership, 'TENANT_READ_ONLY') || hasEffectiveScope(currentMembership, 'SERVICE_COMPLETE');
};

export const hasServiceManagePermission = (memberships = [], tenantId) => {
  const currentMembership = getCurrentMembership(memberships, tenantId, 'SERVICE');
  return hasEffectiveScope(currentMembership, 'SERVICE_COMPLETE');
};

export const toServiceErrorMessage = (error, fallbackMessage) => {
  const status = error?.status;
  const message = normalizeApiErrorMessage(error?.message, status, fallbackMessage);
  if (status === 403 || /access denied/i.test(String(error?.message || ''))) {
    return SERVICE_PERMISSION_GUIDE;
  }
  return message || fallbackMessage;
};

export const fetchWithAuth = async (url, options = {}) => {
  const token = useAuthStore.getState().accessToken;
  return apiFetchJson(url, options, { token, fallbackMessage: normalizeApiErrorMessage('', undefined) });
};

export const fetchProviderRequests = async (tenantId, status, page = 0, size = 20) => {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (status) params.set('status', status);
  return fetchWithAuth(`/workflows/tenants/${encodeURIComponent(tenantId)}/service-requests?${params.toString()}`);
};

export const fetchAllProviderRequests = async (tenantId, status, size = 100) => {
  const firstPage = await fetchProviderRequests(tenantId, status, 0, size);
  const totalPages = Math.max(1, firstPage?.totalPages || 1);
  const content = Array.isArray(firstPage?.content) ? [...firstPage.content] : [];

  if (totalPages === 1) {
    return content;
  }

  const restPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchProviderRequests(tenantId, status, index + 1, size)
    )
  );

  restPages.forEach((pageResult) => {
    if (Array.isArray(pageResult?.content)) {
      content.push(...pageResult.content);
    }
  });

  return content;
};

export const acceptProviderRequest = async (tenantId, serviceRequestId, payload) =>
  fetchWithAuth(
    `/workflows/tenants/${encodeURIComponent(tenantId)}/service-requests/${encodeURIComponent(serviceRequestId)}/accept`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

export const completeProviderRequest = async (tenantId, serviceRequestId, payload) =>
  fetchWithAuth(
    `/workflows/tenants/${encodeURIComponent(tenantId)}/service-requests/${encodeURIComponent(serviceRequestId)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

export const rejectProviderRequest = async (tenantId, serviceRequestId, payload) =>
  fetchWithAuth(
    `/workflows/tenants/${encodeURIComponent(tenantId)}/service-requests/${encodeURIComponent(serviceRequestId)}/reject`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

export const presignProviderServiceEvidence = async (tenantId, payload) =>
  fetchWithAuth(`/workflows/tenants/${encodeURIComponent(tenantId)}/service-requests/evidences/presign`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const completeProviderServiceEvidence = async (tenantId, payload) =>
  fetchWithAuth(`/workflows/tenants/${encodeURIComponent(tenantId)}/service-requests/evidences/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

export const SERVICE_TYPE_META = {
  options: SERVICE_TYPE_OPTIONS,
  labelOf: getServiceTypeLabel,
};

export const SERVICE_REQUEST_METHOD_META = {
  options: SERVICE_REQUEST_METHOD_OPTIONS,
  labelOf: getServiceRequestMethodLabel,
};
