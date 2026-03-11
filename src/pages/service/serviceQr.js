export const extractPassportIdFromQr = (decodedText) => {
  const raw = String(decodedText || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const matchedPath = url.pathname.match(/^\/products\/passports\/([^/]+)$/);
    if (matchedPath?.[1]) {
      return decodeURIComponent(matchedPath[1]);
    }
  } catch {
    // Raw text QR is also allowed.
  }

  const matchedText = raw.match(/\/products\/passports\/([^/?#]+)/);
  if (matchedText?.[1]) {
    return decodeURIComponent(matchedText[1]);
  }

  return raw;
};
