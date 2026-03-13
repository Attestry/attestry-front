export const AUTH_NOTICE_KEY = 'attestry.auth.notice';
export const AUTH_EVENT_NAME = 'attestry:auth-expired';

export const setAuthNotice = (message) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(AUTH_NOTICE_KEY, String(message || '').trim());
};

export const consumeAuthNotice = () => {
  if (typeof window === 'undefined') return '';
  const message = window.sessionStorage.getItem(AUTH_NOTICE_KEY) || '';
  window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return message;
};

export const dispatchAuthExpired = (message) => {
  if (typeof window === 'undefined') return;
  setAuthNotice(message);
  window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAME, { detail: { message } }));
};
