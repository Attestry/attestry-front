export const parsePassportIdFromQr = (rawValue) => {
  const value = String(rawValue || '').trim();
  if (!value) return '';

  const cleanPathValue = (candidate) => String(candidate || '').split('?')[0].split('#')[0].trim();

  try {
    const url = new URL(value);
    const queryPassportId =
      url.searchParams.get('passportId') ||
      url.searchParams.get('id') ||
      '';
    if (queryPassportId) return cleanPathValue(queryPassportId);

    const parts = url.pathname.split('/').filter(Boolean);
    const passportIndex = parts.findIndex((part) => part === 'passports');
    if (passportIndex >= 0 && parts[passportIndex + 1]) {
      return cleanPathValue(decodeURIComponent(parts[passportIndex + 1]));
    }
  } catch {
    // ignore invalid URL values
  }

  try {
    const parsed = JSON.parse(value);
    const jsonPassportId = parsed?.passportId || parsed?.id || '';
    if (jsonPassportId) return cleanPathValue(jsonPassportId);
  } catch {
    // ignore invalid JSON values
  }

  if (value.includes('passports/')) {
    const [, tail = ''] = value.split('passports/');
    return cleanPathValue(decodeURIComponent(tail.split('/')[0]));
  }

  return cleanPathValue(value);
};

export const parseTransferQrPayload = (rawValue) => {
  const value = String(rawValue || '').trim();
  if (!value) return { qrNonce: '', transferId: '' };

  try {
    const url = new URL(value);
    const qrNonce = url.searchParams.get('qrNonce') || url.searchParams.get('nonce') || '';
    const transferId = url.searchParams.get('transferId') || '';
    if (qrNonce || transferId) return { qrNonce, transferId };

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 't') {
      return {
        transferId: parts[1] || '',
        qrNonce: parts[2] || '',
      };
    }
  } catch {
    // ignore invalid URL values
  }

  try {
    const parsed = JSON.parse(value);
    const qrNonce = parsed?.qrNonce || parsed?.nonce || '';
    const transferId = parsed?.transferId || '';
    if (qrNonce || transferId) return { qrNonce, transferId };
  } catch {
    // ignore invalid JSON values
  }

  return { qrNonce: value, transferId: '' };
};
