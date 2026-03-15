import { normalizeApiErrorMessage } from './permissionUi';
import { dispatchAuthExpired } from './authSession';

const API_PREFIX = '/api';

const isApiEnvelope = (payload) => (
  payload &&
  typeof payload === 'object' &&
  typeof payload.success === 'boolean' &&
  ('data' in payload || 'error' in payload)
);

const extractErrorMessage = (payload) => {
  if (isApiEnvelope(payload)) {
    return payload?.error?.message || payload?.error?.code || '';
  }
  if (typeof payload === 'string') {
    return payload.trim();
  }
  if (payload && typeof payload === 'object') {
    if (payload?.error && typeof payload.error === 'object') {
      return payload.error.message || payload.error.code || '';
    }
    return payload.message || payload.error || payload.code || '';
  }
  return '';
};

const readBody = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  return text || null;
};

export const unwrapApiResponse = (payload) => (
  isApiEnvelope(payload) ? payload.data ?? null : payload
);

export const resolveApiUrl = (url) => {
  if (typeof url !== 'string') return url;

  const normalizedUrl = url.trim();
  if (!normalizedUrl) return normalizedUrl;

  if (
    /^(?:[a-z]+:)?\/\//i.test(normalizedUrl)
    || normalizedUrl.startsWith('data:')
    || normalizedUrl.startsWith('blob:')
  ) {
    return normalizedUrl;
  }

  if (normalizedUrl === API_PREFIX || normalizedUrl.startsWith(`${API_PREFIX}/`)) {
    return normalizedUrl;
  }

  if (normalizedUrl.startsWith('/')) {
    return `${API_PREFIX}${normalizedUrl}`;
  }

  return `${API_PREFIX}/${normalizedUrl}`;
};

export const parseApiResponse = async (response, fallbackMessage = '') => {
  if (!response.ok) {
    let rawMessage = '';

    try {
      const payload = await readBody(response);
      rawMessage = extractErrorMessage(payload);
    } catch (e) {
      // ignore body parsing failure
    }

    const error = new Error(
      normalizeApiErrorMessage(rawMessage, response.status, fallbackMessage)
    );
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  const payload = await readBody(response);
  return unwrapApiResponse(payload);
};

export const apiFetchJson = async (url, options = {}, config = {}) => {
  const { token, fallbackMessage = '', skipAuthFailureHandling = false } = config;
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(resolveApiUrl(url), {
    ...options,
    headers,
  });

  const hasAuthSession = !!token || !!localStorage.getItem('accessToken');
  if (response.status === 401 && hasAuthSession && !skipAuthFailureHandling) {
    dispatchAuthExpired('세션이 만료되었거나 권한이 변경되어 다시 로그인해야 합니다.');
  }

  return parseApiResponse(response, fallbackMessage);
};
