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

export const toPermissionMessage = (error, guideKey = 'DEFAULT', fallbackMessage = '') => {
  const message = error?.message || fallbackMessage;
  if (error?.status === 403 || message === 'Access denied') {
    return PERMISSION_GUIDES[guideKey] || PERMISSION_GUIDES.DEFAULT;
  }
  return message || fallbackMessage || PERMISSION_GUIDES.DEFAULT;
};
