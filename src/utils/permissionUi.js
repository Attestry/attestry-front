export const PERMISSION_GUIDES = {
  BRAND_MINT: '현재 계정은 브랜드 발행 권한이 없어 이 기능을 사용할 수 없습니다. 해당 권한이 있는 멤버에게 요청해주세요.',
  BRAND_RELEASE: '현재 계정은 출고 처리 권한이 없어 이 기능을 사용할 수 없습니다. 해당 권한이 있는 멤버에게 요청해주세요.',
  DELEGATION_GRANT: '현재 계정은 유통 위임 권한이 없어 이 기능을 사용할 수 없습니다. 해당 권한이 있는 멤버에게 요청해주세요.',
  RETAIL_TRANSFER_CREATE: '현재 계정은 리테일 양도 처리 권한이 없어 이 기능을 사용할 수 없습니다. 해당 권한이 있는 멤버에게 요청해주세요.',
  DEFAULT: '현재 계정은 이 기능을 사용할 권한이 없습니다. 필요한 권한이 있는 멤버에게 요청해주세요.',
};

export const getCurrentMembership = (memberships = [], tenantId, groupType = null) => (
  (memberships || []).find((membership) =>
    membership?.tenantId === tenantId &&
    String(membership?.status).toUpperCase() === 'ACTIVE' &&
    (!groupType || String(membership?.groupType).toUpperCase() === String(groupType).toUpperCase())
  ) || null
);

export const hasEffectiveScope = (membership, scopeCode) => {
  const normalizedScope = String(scopeCode || '').toUpperCase();
  return (membership?.effectiveScopes || []).some((scope) => {
    const normalized = String(scope).toUpperCase();
    return normalized === normalizedScope || normalized === `SCOPE_${normalizedScope}`;
  });
};

export const createHttpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const normalizeApiErrorMessage = (message, status, fallbackMessage = '') => {
  const rawMessage = String(message || '').trim();
  const normalizedFallback = fallbackMessage || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';

  if (!rawMessage || rawMessage === 'API Error' || /^API Error:\s*\d+$/i.test(rawMessage)) {
    if (status === 401) return '로그인이 필요합니다. 다시 로그인한 뒤 이용해주세요.';
    if (status === 403) return '현재 계정으로는 이 작업을 진행할 수 없습니다.';
    if (status === 404) return '요청한 정보를 찾을 수 없습니다.';
    if (status === 409) return '현재 상태에서는 요청을 처리할 수 없습니다. 화면을 새로고침한 뒤 다시 시도해주세요.';
    if (status >= 500) return '서버와 통신하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
    return normalizedFallback;
  }

  if (/access denied/i.test(rawMessage)) {
    return '현재 계정으로는 이 작업을 진행할 수 없습니다.';
  }

  if (
    rawMessage === 'SERVICE_REQUEST_ALREADY_SUBMITTED'
    || /open service request already exists/i.test(rawMessage)
    || /service request already submitted/i.test(rawMessage)
  ) {
    return '이미 처리 중인 서비스 요청이 있습니다.';
  }

  return rawMessage;
};

export const toPermissionMessage = (error, guideKey = 'DEFAULT', fallbackMessage = '') => {
  const message = normalizeApiErrorMessage(error?.message, error?.status, fallbackMessage);
  if (error?.status === 403 || /access denied/i.test(String(error?.message || ''))) {
    return PERMISSION_GUIDES[guideKey] || PERMISSION_GUIDES.DEFAULT;
  }
  return message || fallbackMessage || PERMISSION_GUIDES.DEFAULT;
};
