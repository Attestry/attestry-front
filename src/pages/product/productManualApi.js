import useAuthStore from '../../store/useAuthStore';
import { apiFetchJson } from '../../utils/api';
import { normalizeApiErrorMessage } from '../../utils/permissionUi';

const fetchWithAuth = async (url, options = {}, fallbackMessage = '') => {
  const token = useAuthStore.getState().accessToken;
  return apiFetchJson(url, options, {
    token,
    fallbackMessage: normalizeApiErrorMessage('', undefined, fallbackMessage),
  });
};

export const getPassportManualRecipient = (tenantId, passportId) => (
  fetchWithAuth(
    `/workflows/tenants/${encodeURIComponent(tenantId)}/passports/${encodeURIComponent(passportId)}/manual-delivery-recipient`,
    {},
    '메뉴얼 수신 대상을 확인하지 못했습니다.'
  )
);

export const presignPassportManualEvidence = (tenantId, payload) => (
  fetchWithAuth(
    `/workflows/tenants/${encodeURIComponent(tenantId)}/passport-manuals/evidences/presign`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    '첨부 업로드 준비에 실패했습니다.'
  )
);

export const completePassportManualEvidence = (tenantId, payload) => (
  fetchWithAuth(
    `/workflows/tenants/${encodeURIComponent(tenantId)}/passport-manuals/evidences/complete`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    '첨부 업로드를 완료하지 못했습니다.'
  )
);

export const sendPassportManual = (tenantId, passportId, payload) => (
  fetchWithAuth(
    `/workflows/tenants/${encodeURIComponent(tenantId)}/passports/${encodeURIComponent(passportId)}/manual-deliveries`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    '메뉴얼 전송에 실패했습니다.'
  )
);
