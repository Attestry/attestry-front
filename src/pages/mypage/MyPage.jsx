import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import useAuthStore from '../../store/useAuthStore';
import { apiFetchJson } from '../../utils/api';
import { User, Shield, FileText, Settings, Loader2, WalletCards, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROLES } from '../../store/useAuthStore';
import MyServiceRequestsUserPage from '../service/MyServiceRequestsUserPage';

const RISK_OPTIONS = [
  {
    value: 'LOST',
    title: '분실 신고',
    description: '분실 사실을 기록하고 공개 원장에 이력을 남깁니다.',
  },
  {
    value: 'STOLEN',
    title: '도난 신고',
    description: '도난 신고번호와 함께 기록하고 공개 원장에 남깁니다.',
  },
];

const getRiskFlagLabel = (riskFlag) => {
  if (riskFlag === 'LOST') return '분실 신고됨';
  if (riskFlag === 'STOLEN') return '도난 신고됨';
  return '정상';
};

const getRiskFlagClassName = (riskFlag) => {
  if (riskFlag === 'LOST') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (riskFlag === 'STOLEN') return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
};

const assetActionButtonClassName = 'inline-flex min-h-[38px] items-center justify-center rounded-xl px-3 py-2 text-[11px] font-semibold tracking-[0.02em] transition-all duration-200';
const assetActionPrimaryClassName = `${assetActionButtonClassName} border border-[#162033] bg-[linear-gradient(180deg,#0b1220_0%,#0f172a_100%)] text-slate-100 shadow-[0_10px_18px_-18px_rgba(11,18,32,0.92)] hover:border-[#22314d] hover:text-white`;
const assetActionWarmClassName = `${assetActionPrimaryClassName}`;
const assetActionDangerClassName = `${assetActionPrimaryClassName}`;
const assetActionDangerSoftClassName = `${assetActionPrimaryClassName}`;
const assetLedgerButtonClassName = `${assetActionPrimaryClassName}`;
const assetRiskLinkClassName = 'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium tracking-[0.01em] text-slate-500 transition-colors duration-200 hover:border-slate-300 hover:text-slate-800';

const MyPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, accessToken, myMemberships, myApplications, myAccount, fetchMyMemberships, listMyApplications, fetchMyAccount, updateMyAccount, getApplication } = useAuthStore();
  const canViewMyServiceRequests = user?.role === ROLES.USER;
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    const allowedTabs = ['membership', 'assets', 'account', 'applications'];
    if (canViewMyServiceRequests) {
      allowedTabs.push('serviceRequests');
    }
    return allowedTabs.includes(tab) ? tab : 'membership';
  });
  const [loading, setLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedPurchaseClaim, setSelectedPurchaseClaim] = useState(null);
  const [selectedPurchaseClaimEvidences, setSelectedPurchaseClaimEvidences] = useState([]);
  const [purchaseClaimEvidenceLoading, setPurchaseClaimEvidenceLoading] = useState(false);
  const [purchaseClaimEvidenceError, setPurchaseClaimEvidenceError] = useState('');
  const [purchaseClaimSearch, setPurchaseClaimSearch] = useState('');
  const [appDetailLoading, setAppDetailLoading] = useState(false);
  const [myPurchaseClaims, setMyPurchaseClaims] = useState([]);
  const [purchaseClaimError, setPurchaseClaimError] = useState('');
  const [myPassports, setMyPassports] = useState([]);
  const [passportError, setPassportError] = useState('');
  const [selectedPassport, setSelectedPassport] = useState(null);
  const [passportQrImage, setPassportQrImage] = useState('');
  const [passportQrUrl, setPassportQrUrl] = useState('');
  const [passportQrLoading, setPassportQrLoading] = useState(false);
  const [passportQrError, setPassportQrError] = useState('');
  const [transferModalPassport, setTransferModalPassport] = useState(null);
  const [transferCreateMode, setTransferCreateMode] = useState('QR');
  const [transferCreating, setTransferCreating] = useState(false);
  const [transferCreateError, setTransferCreateError] = useState('');
  const [transferNotice, setTransferNotice] = useState('');
  const [transferCreateResult, setTransferCreateResult] = useState(null);
  const [activeTransfer, setActiveTransfer] = useState(null);
  const [transferNow, setTransferNow] = useState(Date.now());
  const [transferShareQrImage, setTransferShareQrImage] = useState('');
  const [transferResolveLoading, setTransferResolveLoading] = useState(false);
  const [transferCompletionInfo, setTransferCompletionInfo] = useState(null);
  const [copyToast, setCopyToast] = useState('');
  const [riskModalPassport, setRiskModalPassport] = useState(null);
  const [riskReportType, setRiskReportType] = useState('LOST');
  const [riskActionLoading, setRiskActionLoading] = useState(false);
  const [riskActionError, setRiskActionError] = useState('');
  const [riskActionNotice, setRiskActionNotice] = useState('');

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const transferStorageUserKey = myAccount?.userId || user?.userId || user?.id || '';
  const transferResolutionReasonRef = useRef('');

  const loadMyPassports = useCallback(async () => {
    if (!accessToken) {
      setMyPassports([]);
      return [];
    }
    try {
      setPassportError('');
      const data = await apiFetchJson('/products/me/passports', {}, { token: accessToken });
      const nextPassports = Array.isArray(data) ? data : [];
      setMyPassports(nextPassports);
      return nextPassports;
    } catch (e) {
      setPassportError(e.message || '내 디지털 자산 목록을 불러오지 못했습니다.');
      setMyPassports([]);
      return [];
    }
  }, [accessToken]);

  useEffect(() => {
    const loadMyPurchaseClaims = async () => {
      if (!accessToken) {
        setMyPurchaseClaims([]);
        return;
      }
      try {
        setPurchaseClaimError('');
        const data = await apiFetchJson('/workflows/purchase-claims/me', {}, { token: accessToken });
        setMyPurchaseClaims(Array.isArray(data) ? data : []);
      } catch (e) {
        setPurchaseClaimError(e.message || '디지털 자산 신청 내역을 불러오지 못했습니다.');
        setMyPurchaseClaims([]);
      }
    };

    const loadData = async () => {
      setLoading(true);

      await Promise.all([
        fetchMyMemberships(),
        listMyApplications(),
        loadMyPurchaseClaims(),
        loadMyPassports(),
        fetchMyAccount().then(res => {
          if (res.success && res.data) {
            setPhoneInput(res.data.phone || '');
          }
        })
      ]);
      setLoading(false);
    };
    loadData();
  }, [accessToken, fetchMyMemberships, listMyApplications, fetchMyAccount]);

  const handlePhoneUpdate = async () => {
    if (!phoneInput || isUpdatingPhone) return;
    setIsUpdatingPhone(true);
    const result = await updateMyAccount({ phone: phoneInput });
    if (!result.success) {
      alert(result.message || '전화번호 변경에 실패했습니다.');
    } else {
      alert('전화번호가 성공적으로 변경되었습니다.');
    }
    setIsUpdatingPhone(false);
  };

  const handleAppClick = async (appId) => {
    setAppDetailLoading(true);
    const result = await getApplication(appId);
    if (result.success && result.data) {
      setSelectedApp(result.data);
    } else {
      alert(result.message || '신청 상세 정보를 불러오는데 실패했습니다.');
    }
    setAppDetailLoading(false);
  };

  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || isUpdatingPassword) return;
    setIsUpdatingPassword(true);
    const result = await updateMyAccount({ currentPassword, newPassword });
    if (!result.success) {
      alert(result.message || '비밀번호 변경에 실패했습니다.');
    } else {
      alert('비밀번호가 성공적으로 변경되었습니다.');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
    }
    setIsUpdatingPassword(false);
  };

  const closeTransferModal = () => {
    setTransferModalPassport(null);
    setTransferResolveLoading(false);
    setTransferCompletionInfo(null);
    setTransferNotice('');
  };

  const handleTransferClick = async (e, passport) => {
    e.stopPropagation();
    setTransferModalPassport(passport);
    setTransferCreateError('');
    setTransferNotice('');
    setTransferCreateResult(null);
    setActiveTransfer(null);
    setTransferShareQrImage('');
    setTransferCompletionInfo(null);
    transferResolutionReasonRef.current = '';
    setTransferResolveLoading(true);

    const serverExisting = await fetchPendingTransfer(passport.passportId);
    const localExisting = readActiveTransfer(passport.passportId, transferStorageUserKey);
    const existing = serverExisting === undefined
      ? localExisting
      : (serverExisting
          ? (serverExisting.mode === 'CODE'
              && localExisting?.mode === 'CODE'
              && localExisting?.transferId === serverExisting.transferId
              ? { ...serverExisting, oneTimeCode: localExisting.oneTimeCode || null }
              : serverExisting)
          : null);

    setActiveTransfer(existing);
    setTransferCreateResult(existing);
    setTransferCreateMode(existing?.mode || 'QR');

    if (existing) {
      saveActiveTransfer(passport.passportId, transferStorageUserKey, existing);
    } else {
      clearActiveTransfer(passport.passportId, transferStorageUserKey);
    }

    if (existing?.mode === 'QR' && existing.shareUrl) {
      try {
        const img = await QRCode.toDataURL(existing.shareUrl, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        setTransferShareQrImage(img);
      } catch {
        setTransferShareQrImage('');
      }
    }
    setTransferResolveLoading(false);
  };

  const handleLedgerHistoryClick = (e, passport) => {
    e.stopPropagation();
    if (!passport?.passportId) return;
    navigate(`/products/passports/${encodeURIComponent(passport.passportId)}`);
  };

  const handleServiceRequestClick = (e, passport) => {
    e.stopPropagation();
    if (!passport?.passportId) return;
    navigate('/service-request/providers', {
      state: {
        selectedPassport: {
          passportId: passport.passportId,
          serialNumber: passport.serialNumber || '',
          modelName: passport.modelName || '',
        },
      },
    });
  };

  const openRiskModal = (passport) => {
    if (!passport?.passportId) return;
    setRiskModalPassport(passport);
    setRiskActionError('');
    setRiskReportType(passport.riskFlag === 'STOLEN' ? 'STOLEN' : 'LOST');
  };

  const handleRiskClick = (e, passport) => {
    e.stopPropagation();
    openRiskModal(passport);
  };

  const closeRiskModal = () => {
    if (riskActionLoading) return;
    setRiskModalPassport(null);
    setRiskActionError('');
  };

  const handleRiskAction = async () => {
    if (!riskModalPassport?.passportId || !accessToken || riskActionLoading) return;

    setRiskActionLoading(true);
    setRiskActionError('');

    try {
      let response = null;
      if (riskModalPassport.riskFlag !== 'NONE') {
        response = await apiFetchJson(`/products/passports/${encodeURIComponent(riskModalPassport.passportId)}/risk`, {
          method: 'DELETE',
        }, { token: accessToken });
      } else if (riskReportType === 'STOLEN') {
        response = await apiFetchJson(`/products/passports/${encodeURIComponent(riskModalPassport.passportId)}/risk/stolen`, {
          method: 'POST',
        }, { token: accessToken });
      } else {
        response = await apiFetchJson(`/products/passports/${encodeURIComponent(riskModalPassport.passportId)}/risk/lost`, {
          method: 'POST',
        }, { token: accessToken });
      }

      const nextPassports = await loadMyPassports();
      const nextRiskFlag = String(response?.riskFlag || (riskModalPassport.riskFlag !== 'NONE' ? 'NONE' : riskReportType)).toUpperCase();
      const updatedPassport = nextPassports.find((passport) => passport.passportId === riskModalPassport.passportId)
        || { ...riskModalPassport, riskFlag: nextRiskFlag };

      setSelectedPassport((prev) => (prev?.passportId === updatedPassport.passportId ? updatedPassport : prev));
      setRiskActionNotice(
        nextRiskFlag === 'NONE'
          ? `${updatedPassport.modelName || updatedPassport.serialNumber || updatedPassport.passportId} 자산의 분실/도난 신고를 취소했습니다. 취소 이력도 공개 원장에 남습니다.`
          : `${updatedPassport.modelName || updatedPassport.serialNumber || updatedPassport.passportId} 자산을 ${getRiskFlagLabel(nextRiskFlag)} 상태로 기록했습니다. 공개 원장에서 이력을 확인할 수 있습니다.`
      );
      setRiskModalPassport(null);
    } catch (e) {
      setRiskActionError(e.message || '분실/도난 처리에 실패했습니다.');
    } finally {
      setRiskActionLoading(false);
    }
  };

  const generateOneTimeCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
  };

  const buildExpiresAt = (mode) => {
    const now = Date.now();
    const ms = mode === 'QR' ? 15 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    return new Date(now + ms).toISOString();
  };

  const toReceiveCode = (transferId, oneTimeCode) => {
    if (!transferId || !oneTimeCode) return '';
    try {
      const tid = String(transferId).trim().toLowerCase();
      const code = String(oneTimeCode).trim().toUpperCase();
      const uuidHex = tid.replace(/-/g, '');
      if (/^[0-9a-f]{32}$/.test(uuidHex) && code.length === 8) {
        const bytes = new Uint8Array(24);
        for (let i = 0; i < 16; i += 1) {
          bytes[i] = parseInt(uuidHex.slice(i * 2, i * 2 + 2), 16);
        }
        for (let i = 0; i < 8; i += 1) {
          bytes[16 + i] = code.charCodeAt(i);
        }
        const binary = String.fromCharCode(...bytes);
        const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        return `TR2.${encoded}`;
      }
      const legacyPayload = `${tid}:${code}`;
      const legacyEncoded = btoa(legacyPayload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      return `TR1.${legacyEncoded}`;
    } catch {
      return '';
    }
  };

  const transferStorageKey = (passportId, userKey) => `active_transfer_${userKey}_${passportId}`;

  const transferStorageKeysForPassport = (passportId, userKey) => {
    if (!passportId) return [];
    const normalizedUserKey = String(userKey || '').trim();
    const keys = normalizedUserKey ? [transferStorageKey(passportId, normalizedUserKey)] : [];
    const suffix = `_${passportId}`;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!key.startsWith('active_transfer_')) continue;
      if (!key.endsWith(suffix)) continue;
      if (!keys.includes(key)) keys.push(key);
    }
    return keys;
  };

  const readActiveTransfer = (passportId, userKey) => {
    if (!passportId) return null;
    const keys = transferStorageKeysForPassport(passportId, userKey);
    if (!keys.length) return null;
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!parsed?.expiresAt) continue;
        if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
          localStorage.removeItem(key);
          continue;
        }
        return parsed;
      } catch {
        // keep scanning other candidates
      }
    }
    return null;
  };

  const saveActiveTransfer = (passportId, userKey, value) => {
    if (!passportId || !value) return;
    const normalizedUserKey = String(userKey || '').trim() || 'anonymous';
    localStorage.setItem(transferStorageKey(passportId, normalizedUserKey), JSON.stringify(value));
  };

  const clearActiveTransfer = (passportId, userKey) => {
    if (!passportId) return;
    const keys = transferStorageKeysForPassport(passportId, userKey);
    keys.forEach((key) => localStorage.removeItem(key));
  };

  const toTransferState = (data, oneTimeCode = null) => ({
    ...data,
    mode: String(data?.acceptMethod || data?.mode || '').toUpperCase() || 'QR',
    oneTimeCode,
    receiveCode: toReceiveCode(data?.transferId, oneTimeCode),
    shareUrl: String(data?.acceptMethod || data?.mode || '').toUpperCase() === 'QR'
      ? `${window.location.origin}/t/${encodeURIComponent(data.transferId)}/${encodeURIComponent(data.qrNonce || '')}`
      : `${window.location.origin}/t/${encodeURIComponent(data.transferId)}`,
  });

  const fetchPendingTransfer = useCallback(async (passportId) => {
    if (!passportId || !accessToken) return null;
    try {
      const data = await apiFetchJson(`/workflows/passports/${encodeURIComponent(passportId)}/transfers/pending`, {}, { token: accessToken });
      return toTransferState(data);
    } catch (error) {
      if (error?.status === 204 || error?.status === 403 || error?.status === 404) return null;
      return undefined;
    }
  }, [accessToken]);

  const formatRemaining = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyToast('수락코드를 클립보드에 복사했습니다.');
    } catch {
      setCopyToast('복사에 실패했습니다. 다시 시도해주세요.');
    }
  };

  useEffect(() => {
    if (!copyToast) return undefined;
    const timer = window.setTimeout(() => setCopyToast(''), 1200);
    return () => window.clearTimeout(timer);
  }, [copyToast]);

  const handleCreateTransfer = async () => {
    if (!transferModalPassport?.passportId || !accessToken || transferCreating) return;

    setTransferCreating(true);
    setTransferCreateError('');
    setTransferCreateResult(null);
    setActiveTransfer(null);
    setTransferShareQrImage('');
    setTransferCompletionInfo(null);
    transferResolutionReasonRef.current = '';
    try {
      const password = transferCreateMode === 'CODE' ? generateOneTimeCode() : null;
      const body = {
        acceptMethod: transferCreateMode,
        expiresAt: buildExpiresAt(transferCreateMode),
        ...(password ? { password } : {}),
      };

      const data = await apiFetchJson(`/workflows/passports/${encodeURIComponent(transferModalPassport.passportId)}/transfers`, {
        method: 'POST',
        body: JSON.stringify(body),
      }, { token: accessToken });
      const baseUrl = `${window.location.origin}/t`;
      const shareUrl = transferCreateMode === 'QR'
        ? `${baseUrl}/${encodeURIComponent(data.transferId)}/${encodeURIComponent(data.qrNonce || '')}`
        : `${baseUrl}/${encodeURIComponent(data.transferId)}`;

      const result = toTransferState({ ...data, acceptMethod: transferCreateMode }, password);
      setTransferCreateResult(result);
      setActiveTransfer(result);
      saveActiveTransfer(transferModalPassport.passportId, transferStorageUserKey, result);

      if (transferCreateMode === 'QR') {
        const qrImage = await QRCode.toDataURL(shareUrl, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        setTransferShareQrImage(qrImage);
      }
    } catch (e) {
      const message = e.message || '양도 생성에 실패했습니다.';
      if (message.includes('TRANSFER_ALREADY_PENDING')) {
        const pending = await fetchPendingTransfer(transferModalPassport.passportId);
        if (pending) {
          const localExisting = readActiveTransfer(transferModalPassport.passportId, transferStorageUserKey);
          const mergedPending = pending.mode === 'CODE'
            && localExisting?.mode === 'CODE'
            && localExisting?.transferId === pending.transferId
            ? { ...pending, oneTimeCode: localExisting.oneTimeCode || null }
            : pending;
          setActiveTransfer(mergedPending);
          setTransferCreateResult(mergedPending);
          setTransferCreateMode(mergedPending.mode);
          saveActiveTransfer(transferModalPassport.passportId, transferStorageUserKey, mergedPending);
          if (mergedPending.mode === 'QR') {
            try {
              const qrImage = await QRCode.toDataURL(mergedPending.shareUrl, {
                width: 320,
                margin: 1,
                errorCorrectionLevel: 'M',
                color: { dark: '#0f172a', light: '#ffffff' },
              });
              setTransferShareQrImage(qrImage);
            } catch {
              setTransferShareQrImage('');
            }
          } else {
            setTransferShareQrImage('');
          }
          setTransferCreateError('');
          return;
        }

        if (pending === undefined) {
          const localExisting = readActiveTransfer(transferModalPassport.passportId, transferStorageUserKey);
          if (localExisting) {
            setActiveTransfer(localExisting);
            setTransferCreateResult(localExisting);
            setTransferCreateMode(localExisting.mode);
            if (localExisting.mode === 'QR' && localExisting.shareUrl) {
              try {
                const qrImage = await QRCode.toDataURL(localExisting.shareUrl, {
                  width: 320,
                  margin: 1,
                  errorCorrectionLevel: 'M',
                  color: { dark: '#0f172a', light: '#ffffff' },
                });
                setTransferShareQrImage(qrImage);
              } catch {
                setTransferShareQrImage('');
              }
            } else {
              setTransferShareQrImage('');
            }
            setTransferCreateError('');
            return;
          }
        }
      }
      setTransferCreateError(message);
    } finally {
      setTransferCreating(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!activeTransfer?.transferId || !accessToken || !transferModalPassport?.passportId) return;
    try {
      transferResolutionReasonRef.current = 'cancel';
      await apiFetchJson(`/workflows/transfers/${encodeURIComponent(activeTransfer.transferId)}/cancel`, {
        method: 'POST',
      }, { token: accessToken });
      clearActiveTransfer(transferModalPassport.passportId, transferStorageUserKey);
      setActiveTransfer(null);
      setTransferCreateResult(null);
      setTransferShareQrImage('');
      setTransferCreateError('');
      setTransferNotice('양도 요청이 정상적으로 취소되었습니다.');
    } catch (e) {
      setTransferCreateError(e.message || '양도 취소에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (!transferModalPassport) return;
    const timer = setInterval(() => setTransferNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [transferModalPassport]);

  useEffect(() => {
    if (!activeTransfer?.expiresAt || !transferModalPassport?.passportId) return;
    if (new Date(activeTransfer.expiresAt).getTime() <= transferNow) {
      transferResolutionReasonRef.current = 'expired';
      clearActiveTransfer(transferModalPassport.passportId, transferStorageUserKey);
      setActiveTransfer(null);
      setTransferCreateResult(null);
      setTransferShareQrImage('');
      setTransferCreateError('기존 양도 요청이 만료되었습니다. 새로 생성해주세요.');
    }
  }, [activeTransfer, transferNow, transferModalPassport]);

  useEffect(() => {
    if (!transferModalPassport?.passportId || !activeTransfer?.transferId || transferResolveLoading || transferCreating || transferCompletionInfo) {
      return undefined;
    }

    let cancelled = false;

    const pollTransferResolution = async () => {
      const pending = await fetchPendingTransfer(transferModalPassport.passportId);
      if (cancelled || pending === undefined) return;

      if (pending?.transferId) {
        const mergedPending = pending.mode === 'CODE'
          && activeTransfer?.mode === 'CODE'
          && activeTransfer?.transferId === pending.transferId
          ? {
              ...pending,
              oneTimeCode: activeTransfer.oneTimeCode || null,
              receiveCode: activeTransfer.receiveCode || pending.receiveCode,
            }
          : pending;

        if (mergedPending.transferId !== activeTransfer.transferId || mergedPending.expiresAt !== activeTransfer.expiresAt) {
          setActiveTransfer(mergedPending);
          setTransferCreateResult(mergedPending);
          saveActiveTransfer(transferModalPassport.passportId, transferStorageUserKey, mergedPending);
        }
        return;
      }

      clearActiveTransfer(transferModalPassport.passportId, transferStorageUserKey);
      setActiveTransfer(null);
      setTransferCreateResult(null);
      setTransferShareQrImage('');

      const resolutionReason = transferResolutionReasonRef.current;

      void loadMyPassports();
      if (!resolutionReason) {
        setTransferCompletionInfo({
          transferId: activeTransfer.transferId,
          mode: activeTransfer.mode,
          serialNumber: transferModalPassport.serialNumber || '-',
          modelName: transferModalPassport.modelName || '-',
          completedAt: new Date().toISOString(),
        });
        setTransferCreateError('');
        return;
      }
      transferResolutionReasonRef.current = '';
    };

    void pollTransferResolution();
    const intervalId = window.setInterval(() => {
      void pollTransferResolution();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    activeTransfer,
    fetchPendingTransfer,
    loadMyPassports,
    transferCompletionInfo,
    transferCreating,
    transferModalPassport,
    transferResolveLoading,
    transferStorageUserKey,
  ]);

  useEffect(() => {
    const preloaded = Array.isArray(selectedPurchaseClaim?.evidences) ? selectedPurchaseClaim.evidences : [];
    if (!selectedPurchaseClaim?.claimId) {
      setSelectedPurchaseClaimEvidences([]);
      setPurchaseClaimEvidenceLoading(false);
      setPurchaseClaimEvidenceError('');
      return;
    }
    if (preloaded.length > 0) {
      setSelectedPurchaseClaimEvidences(preloaded);
      setPurchaseClaimEvidenceLoading(false);
      setPurchaseClaimEvidenceError('');
      return;
    }

    if (!accessToken) {
      setSelectedPurchaseClaimEvidences([]);
      setPurchaseClaimEvidenceLoading(false);
      setPurchaseClaimEvidenceError('로그인이 필요합니다.');
      return;
    }

    const loadFallbackEvidences = async () => {
      try {
        setPurchaseClaimEvidenceLoading(true);
        setPurchaseClaimEvidenceError('');
        const data = await apiFetchJson(`/workflows/purchase-claims/${encodeURIComponent(selectedPurchaseClaim.claimId)}/evidences`, {}, { token: accessToken });
        setSelectedPurchaseClaimEvidences(Array.isArray(data) ? data : []);
      } catch {
        setSelectedPurchaseClaimEvidences([]);
        setPurchaseClaimEvidenceError('증빙 자료 파일 조회에 실패했습니다.');
      } finally {
        setPurchaseClaimEvidenceLoading(false);
      }
    };
    loadFallbackEvidences();
  }, [selectedPurchaseClaim?.claimId, selectedPurchaseClaim?.evidences, accessToken]);

  const tabs = [
    { id: 'membership', label: '소속/권한 관리', icon: <Shield size={18} /> },
    { id: 'assets', label: '내 디지털 자산', icon: <WalletCards size={18} /> },
    { id: 'account', label: '나의 계정 관리', icon: <Settings size={18} /> },
    { id: 'applications', label: '나의 신청 현황', icon: <FileText size={18} /> },
    ...(canViewMyServiceRequests ? [{ id: 'serviceRequests', label: '신청한 서비스 이력', icon: <FileText size={18} /> }] : []),
  ];

  const resolvePurchaseClaimType = (claim) => {
    const rawType = String(
      claim?.profileType
      || claim?.submitterProfileType
      || claim?.claimType
      || ''
    ).toUpperCase();
    if (rawType === 'BRAND') return 'BRAND';
    if (rawType === 'OWNER' || rawType === 'USER') return 'OWNER';
    return 'OWNER';
  };
  const claimStatusClass = (status) => {
    if (status === 'APPROVED') return 'bg-green-100 text-green-700';
    if (status === 'REJECTED') return 'bg-red-100 text-red-700';
    return 'bg-blue-100 text-blue-700';
  };
  const isRiskActive = (passport) => String(passport?.riskFlag || 'NONE').toUpperCase() !== 'NONE';
  const displayPurchaseClaims = myPurchaseClaims || [];
  const filteredPurchaseClaims = useMemo(() => {
    const keyword = purchaseClaimSearch.trim().toLowerCase();
    if (!keyword) return displayPurchaseClaims;
    return displayPurchaseClaims.filter((claim) =>
      String(claim?.serialNumber || '').toLowerCase().includes(keyword)
      || String(claim?.modelName || '').toLowerCase().includes(keyword)
    );
  }, [displayPurchaseClaims, purchaseClaimSearch]);
  const ownedPassportsSorted = [...(myPassports || [])]
    .sort((a, b) =>
      String(a?.serialNumber || '').localeCompare(String(b?.serialNumber || ''), 'ko', {
        numeric: true,
        sensitivity: 'base',
      })
    );

  useEffect(() => {
    if (!selectedPassport?.passportId) {
      setPassportQrImage('');
      setPassportQrUrl('');
      setPassportQrError('');
      setPassportQrLoading(false);
      return;
    }

    const publicUrl = `${window.location.origin}/products/passports/${encodeURIComponent(selectedPassport.passportId)}`;
    setPassportQrUrl(publicUrl);
    setPassportQrLoading(true);
    setPassportQrError('');

    QRCode.toDataURL(publicUrl, {
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        setPassportQrImage(dataUrl);
      })
      .catch(() => {
        setPassportQrImage('');
        setPassportQrError('공개용 QR 이미지 생성에 실패했습니다.');
      })
      .finally(() => {
        setPassportQrLoading(false);
      });
  }, [selectedPassport]);

  return (
    <div className="tracera-page-shell">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* Header Section */}
        <div className="tracera-page-hero mb-6">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-4 sm:gap-6">
              <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-[1.7rem] bg-[linear-gradient(135deg,#0f172a_0%,#3f4b5f_100%)] text-white shadow-[0_20px_48px_-24px_rgba(15,23,42,0.55)] sm:h-20 sm:w-20">
                <User size={34} />
              </div>
              <div className="min-w-0">
                <div className="tracera-page-tag">MY PAGE</div>
                <h1 className="tracera-keepall mt-4 text-3xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-[2.5rem]">
                  {myAccount?.email || user?.email || '사용자'}님, 안녕하세요.
                </h1>
                <p className="tracera-keepall mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[0.98rem]">
                  디지털 자산, 계정 정보, 신청 이력, 서비스 요청을 하나의 문맥으로 정리해 보여줍니다.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="tracera-page-pill">자산 {ownedPassportsSorted.length}개</span>
              <span className="tracera-page-pill">신청 {displayPurchaseClaims.length}건</span>
              {canViewMyServiceRequests && <span className="tracera-page-pill">서비스 이력 사용 가능</span>}
            </div>
          </div>
        </div>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        {/* Sidebar Nav */}
        <div className="md:w-72 flex-shrink-0">
          <div className="tracera-page-card overflow-hidden">
            <div className="p-4 md:hidden">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                메뉴 선택
              </label>
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none"
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden md:block">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${activeTab === tab.id
                    ? 'bg-[linear-gradient(90deg,rgba(255,255,255,0.85),rgba(248,250,252,0.95))] text-slate-950 font-semibold border-l-4 border-slate-950'
                    : 'text-slate-500 hover:bg-slate-50/80 hover:text-slate-900 border-l-4 border-transparent'
                    }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <div className={`${activeTab === tab.id ? 'text-slate-900' : 'text-slate-400'}`}>
                    {tab.icon}
                  </div>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="min-w-0 flex-1">
          {activeTab === 'membership' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Shield className="text-blue-600" />
                소속/권한 관리
              </h2>
              {loading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
              ) : myMemberships?.length > 0 ? (
                <div className="space-y-4">
                  {myMemberships.map((membership) => (
                    <div key={membership.membershipId} className="p-5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-lg font-bold text-gray-800">{membership.tenantName || '이름 없음'} <span className="text-sm font-normal text-gray-500 ml-2">({membership.groupType || '알 수 없음'})</span></div>
                        <div className="text-sm text-gray-500 mt-1">
                          역할: {membership.roleCodes?.join(', ') || '없음'}
                        </div>
                      </div>
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${membership.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {membership.status === 'ACTIVE' ? '활성화' : membership.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-100">
                  <Shield size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">가입된 그룹(기업/테넌트)이 없습니다.</h3>
                  <p className="text-gray-500 text-sm mb-6">
                    현재 일반 사용자 계정입니다.<br />
                    제품 인증서나 이벤트를 조회하는 등 일반적인 기능은 정상 이용 가능합니다.<br />
                    만약 기업 고객이시라면 업체 신청을 통해 그룹 멤버로 합류할 수 있습니다.
                  </p>
                  <button
                    onClick={() => navigate('/onboarding')}
                    className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    업체 신청하러 가기
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'account' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-in fade-in duration-300">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Settings className="text-gray-600" />
                  나의 계정 관리
                </h2>
                {myAccount?.status === 'ACTIVE' && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full border border-green-200">활성화 됨</span>
                )}
              </div>
              <div className="space-y-8">
                {/* Read-only Information */}
                <div>
                  <h3 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">기본 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">사용자 ID</label>
                      <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-200 text-gray-500 font-medium break-all cursor-not-allowed">
                        {myAccount?.userId || user?.id || '정보 없음'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">이메일</label>
                      <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-200 text-gray-500 font-medium break-all cursor-not-allowed">
                        {myAccount?.email || user?.email || '정보 없음'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Editable Information */}
                <div>
                  <h3 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">연락처 및 보안</h3>
                  <div className="grid grid-cols-1 gap-6 max-w-lg">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">전화번호</label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="flex-1 px-4 py-2 bg-white rounded-lg border border-gray-300 text-gray-900 font-medium focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                          placeholder="010-0000-0000"
                        />
                        <button
                          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
                          onClick={handlePhoneUpdate}
                          disabled={isUpdatingPhone || phoneInput === myAccount?.phone}
                        >
                          {isUpdatingPhone ? '저장 중...' : '변경 저장'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                      <label className="text-sm font-medium text-gray-700">비밀번호 변경</label>
                      {!isChangingPassword ? (
                        <button
                          className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                          onClick={() => setIsChangingPassword(true)}
                        >
                          <Shield size={16} /> 안전하게 비밀번호 변경하기
                        </button>
                      ) : (
                        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="현재 비밀번호 입력"
                            className="w-full px-4 py-2 bg-white rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900 outline-none"
                          />
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="새 비밀번호 입력 (대문자 포함 8자 이상)"
                            className="w-full px-4 py-2 bg-white rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900 outline-none"
                          />
                          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                            <button
                              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                              onClick={handlePasswordUpdate}
                              disabled={isUpdatingPassword || !currentPassword || !newPassword}
                            >
                              {isUpdatingPassword ? '저장 중...' : '비밀번호 변경 적용'}
                            </button>
                            <button
                              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                              onClick={() => {
                                setIsChangingPassword(false);
                                setCurrentPassword('');
                                setNewPassword('');
                              }}
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <WalletCards className="text-blue-600" />
                내 디지털 자산
              </h2>

              {loading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
              ) : (
                <div className="space-y-4">
                  {passportError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {passportError}
                    </div>
                  )}

                  {riskActionNotice && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {riskActionNotice}
                    </div>
                  )}

                  {ownedPassportsSorted.length > 0 ? (
                    ownedPassportsSorted.map((passport) => (
                      <div
                        key={passport.passportId}
                        onClick={() => setSelectedPassport(passport)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedPassport(passport);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className="w-full rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-lg font-bold tracking-tight text-slate-900">{passport.serialNumber || '-'}</div>
                            <div className="mt-1 text-sm text-slate-600">모델: {passport.modelName || '-'}</div>
                            <div className="mt-2 text-xs text-slate-400 font-mono break-all">
                              Passport: {passport.passportId}
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 sm:items-end">
                            {isRiskActive(passport) && (
                              <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getRiskFlagClassName(passport.riskFlag)}`}>
                                {getRiskFlagLabel(passport.riskFlag)}
                              </span>
                            )}
                            <div className="grid grid-cols-2 gap-2 sm:w-[17rem]">
                              <button
                                type="button"
                                onClick={(e) => handleTransferClick(e, passport)}
                                className={`${assetActionPrimaryClassName} col-span-1`}
                              >
                                양도하기
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleServiceRequestClick(e, passport)}
                                className={`${assetActionWarmClassName} col-span-1`}
                              >
                                서비스 신청
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleLedgerHistoryClick(e, passport)}
                                className={`${assetLedgerButtonClassName} col-span-2`}
                              >
                                원장 이력
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleRiskClick(e, passport)}
                              className={assetRiskLinkClassName}
                            >
                              {isRiskActive(passport) ? '분실/도난 신고 취소' : '분실/도난 신고'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-5 py-8 text-center text-sm text-gray-600">
                      보유 중인 디지털 자산이 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <FileText className="text-indigo-600" />
                나의 신청 현황
              </h2>
              {loading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">업체 신청 내역</h3>
                    {(myApplications?.length > 0) ? (
                      <div className="space-y-4">
                        {myApplications.map((app) => (
                          <div
                            key={app.applicationId}
                            className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between cursor-pointer hover:bg-indigo-50 transition-colors"
                            onClick={() => handleAppClick(app.applicationId)}
                          >
                            <div>
                              <div className="text-lg font-bold text-gray-800">{app.orgName} <span className="text-sm font-normal text-gray-500 ml-2">({app.type})</span></div>
                              <div className="text-sm text-gray-500 mt-1">사업자 등록번호: {app.bizRegNo} | 국가: {app.country}</div>
                              {app.rejectReason && <div className="text-sm text-red-500 mt-1 font-medium">반려 사유: {app.rejectReason}</div>}
                            </div>
                            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${app.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                              app.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                              {app.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-indigo-50/50 rounded-xl p-6 text-center border border-indigo-100 text-gray-500">
                        업체 신청 내역이 없습니다.
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">디지털 자산 등록 신청 내역</h3>
                    <div className="mb-3">
                      <input
                        type="text"
                        value={purchaseClaimSearch}
                        onChange={(e) => setPurchaseClaimSearch(e.target.value)}
                        placeholder="모델명 또는 시리얼 번호로 검색"
                        className="w-full rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    {purchaseClaimError && (
                      <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {purchaseClaimError}
                      </div>
                    )}
                    {filteredPurchaseClaims.length > 0 ? (
                      <div className="space-y-4">
                        {filteredPurchaseClaims.map((claim) => (
                          <button
                            key={claim.claimId}
                            type="button"
                            onClick={() => setSelectedPurchaseClaim(claim)}
                            className="w-full text-left p-5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between hover:bg-indigo-50 transition-colors"
                          >
                            <div>
                              <div className="text-lg font-bold text-gray-800">
                                {claim.serialNumber || '-'}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">모델: {claim.modelName || '-'}</div>
                              <div className="text-xs text-gray-500 mt-1 font-mono break-all">{claim.claimId}</div>
                              {claim.rejectionReason && <div className="text-sm text-red-500 mt-1 font-medium">반려 사유: {claim.rejectionReason}</div>}
                            </div>
                            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${claimStatusClass(claim.status)}`}>
                              {claim.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-indigo-50/50 rounded-xl p-6 text-center border border-indigo-100 text-gray-500">
                        {displayPurchaseClaims.length > 0 ? '검색 조건에 맞는 디지털 자산 등록 신청 내역이 없습니다.' : '디지털 자산 등록 신청 내역이 없습니다.'}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          )}

          {activeTab === 'serviceRequests' && canViewMyServiceRequests && (
            <div className="animate-in fade-in duration-300">
              <MyServiceRequestsUserPage />
            </div>
          )}
        </div>
      </div>

      {/* Application Detail Modal */}
      {appDetailLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Loader2 className="animate-spin text-white" size={48} />
        </div>
      )}

      {selectedApp && !appDetailLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="text-indigo-600" />
                업체 신청 상세 정보
              </h3>
              <button onClick={() => setSelectedApp(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-y-5 gap-x-6 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">신청 기관명</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedApp.orgName}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">신청 타입</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedApp.type}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">국가</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedApp.country}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 mb-1">주소</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedApp.address || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">사업자 등록번호</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedApp.bizRegNo}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 mb-1">증빙 자료 파일</div>
                  {Array.isArray(selectedApp.evidenceFiles) && selectedApp.evidenceFiles.length > 0 ? (
                    <div className="space-y-2">
                      {selectedApp.evidenceFiles.map((file, idx) => (
                        <a
                          key={file.evidenceFileId || idx}
                          href={file.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                        >
                          <FileText size={16} />
                          {file.originalFileName || `첨부파일 ${idx + 1}`}
                        </a>
                      ))}
                    </div>
                  ) : selectedApp.evidenceOriginalFileName ? (
                    <a
                      href={selectedApp.evidenceDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                    >
                      <FileText size={16} />
                      {selectedApp.evidenceOriginalFileName}
                    </a>
                  ) : <div className="text-gray-500">첨부 파일 없음</div>}
                </div>
                <div>
                  <div className="text-gray-500 mb-1">상태</div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${selectedApp.status === 'APPROVED' ? 'bg-green-100 text-green-700' : selectedApp.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {selectedApp.status}
                  </span>
                </div>
              </div>

              {selectedApp.rejectReason && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 mt-4">
                  <div className="text-red-700 font-semibold mb-1 text-sm">반려 사유</div>
                  <div className="text-red-600 text-sm whitespace-pre-wrap">{selectedApp.rejectReason}</div>
                </div>
              )}
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedApp(null)}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPurchaseClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="text-indigo-600" />
                디지털 자산 신청 상세 정보
              </h3>
              <button onClick={() => setSelectedPurchaseClaim(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-y-5 gap-x-6 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">시리얼 번호</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedPurchaseClaim.serialNumber || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">모델명</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedPurchaseClaim.modelName || '-'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 mb-1">Claim ID</div>
                  <div className="font-semibold text-gray-900 break-all">{selectedPurchaseClaim.claimId || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">타입</div>
                  <div className="font-semibold text-gray-900">{resolvePurchaseClaimType(selectedPurchaseClaim)}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">상태</div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${claimStatusClass(selectedPurchaseClaim.status)}`}>
                    {selectedPurchaseClaim.status}
                  </span>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">신청 일시</div>
                  <div className="font-semibold text-gray-900">{selectedPurchaseClaim.submittedAt ? new Date(selectedPurchaseClaim.submittedAt).toLocaleString() : '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Passport ID</div>
                  <div className="font-semibold text-gray-900 break-all">{selectedPurchaseClaim.passportId || '-'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 mb-1">Asset ID</div>
                  <div className="font-semibold text-gray-900 break-all">{selectedPurchaseClaim.assetId || '-'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 mb-1">증빙 자료 파일</div>
                  {purchaseClaimEvidenceLoading ? (
                    <div className="text-sm text-gray-500">불러오는 중...</div>
                  ) : purchaseClaimEvidenceError ? (
                    <div className="text-sm text-red-600">{purchaseClaimEvidenceError}</div>
                  ) : selectedPurchaseClaimEvidences.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPurchaseClaimEvidences.map((evidence, idx) => (
                        evidence.downloadUrl ? (
                          <a
                            key={`${evidence.evidenceId}-${idx}`}
                            href={evidence.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline break-all mr-3"
                          >
                            <FileText size={16} />
                            첨부파일 {idx + 1}
                          </a>
                        ) : (
                          <div key={`${evidence.evidenceId}-${idx}`} className="text-sm text-gray-700">
                            첨부파일 {idx + 1}
                            {evidence.fileName ? ` · ${evidence.fileName}` : ''}
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">첨부 파일 없음</div>
                  )}
                </div>
              </div>

              {selectedPurchaseClaim.rejectionReason && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 mt-4">
                  <div className="text-red-700 font-semibold mb-1 text-sm">반려 사유</div>
                  <div className="text-red-600 text-sm whitespace-pre-wrap">{selectedPurchaseClaim.rejectionReason}</div>
                </div>
              )}
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedPurchaseClaim(null)}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPassport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <WalletCards className="text-blue-600" />
                내 디지털 자산 상세
              </h3>
              <button onClick={() => setSelectedPassport(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <div>
                <div className="text-gray-500 mb-1">모델명</div>
                <div className="font-semibold text-gray-900 text-base">{selectedPassport.modelName || '-'}</div>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <div className="text-gray-700 mb-2 font-semibold">공개용 QR</div>
                {passportQrLoading ? (
                  <div className="text-sm text-gray-500">QR 생성 중...</div>
                ) : passportQrError ? (
                  <div className="text-sm text-red-600">{passportQrError}</div>
                ) : passportQrImage ? (
                  <div className="space-y-3">
                    <img
                      src={passportQrImage}
                      alt="디지털 자산 공개용 QR"
                      className="mx-auto h-56 w-56 rounded-lg border border-white bg-white p-2"
                    />
                    <div className="text-xs text-gray-500 break-all">{passportQrUrl}</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">QR 정보가 없습니다.</div>
                )}
              </div>
              <div>
                <div className="text-gray-500 mb-1">시리얼 번호</div>
                <div className="font-semibold text-gray-900">{selectedPassport.serialNumber || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Passport ID</div>
                <div className="font-semibold text-gray-900 break-all">{selectedPassport.passportId || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">Asset ID</div>
                <div className="font-semibold text-gray-900 break-all">{selectedPassport.assetId || '-'}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">리스크 상태</div>
                <div className="flex items-center justify-between gap-3">
                  {isRiskActive(selectedPassport) ? (
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskFlagClassName(selectedPassport.riskFlag)}`}>
                      {getRiskFlagLabel(selectedPassport.riskFlag)}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-slate-500">신고 이력 없음</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const passport = selectedPassport;
                      setSelectedPassport(null);
                      openRiskModal(passport);
                    }}
                    className={isRiskActive(selectedPassport)
                      ? assetActionDangerSoftClassName
                      : assetActionDangerClassName
                    }
                  >
                    {isRiskActive(selectedPassport) ? '신고 취소' : '분실/도난 신고'}
                  </button>
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">보유 시작일</div>
                <div className="font-semibold text-gray-900">
                  {selectedPassport.ownedSince ? new Date(selectedPassport.ownedSince).toLocaleString() : '-'}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedPassport(null)}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {riskModalPassport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-[linear-gradient(135deg,#fff1f2,#ffffff)]">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="text-rose-600" />
                {isRiskActive(riskModalPassport) ? '분실/도난 신고 취소' : '분실/도난 신고'}
              </h3>
              <button
                onClick={closeRiskModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5">
                <div className="text-xs font-semibold tracking-wide text-rose-700 uppercase">신청 대상 자산</div>
                <div className="mt-3 space-y-2">
                  <div className="text-lg font-bold tracking-tight text-gray-900">
                    {riskModalPassport.modelName || riskModalPassport.serialNumber || riskModalPassport.passportId}
                  </div>
                  <div className="text-xs text-gray-600">Serial: {riskModalPassport.serialNumber || '-'}</div>
                  <div className="text-xs text-gray-500 font-mono break-all">Passport: {riskModalPassport.passportId}</div>
                </div>
              </div>

              {riskActionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {riskActionError}
                </div>
              )}

              {isRiskActive(riskModalPassport) ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold text-slate-500">현재 상태</div>
                    <div className="mt-2">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskFlagClassName(riskModalPassport.riskFlag)}`}>
                        {getRiskFlagLabel(riskModalPassport.riskFlag)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      신고를 취소하면 현재 리스크 상태가 해제되고, 해제 이력 역시 원장에 기록됩니다.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">신고 유형 선택</div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {RISK_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setRiskReportType(option.value)}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${riskReportType === option.value
                            ? 'border-rose-200 bg-rose-50 text-rose-900 shadow-[0_16px_40px_-28px_rgba(225,29,72,.28)]'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="text-sm font-semibold">{option.title}</div>
                          <div className="mt-2 text-xs leading-5">{option.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {riskReportType === 'STOLEN' ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-900">
                      도난 신고는 별도 입력 없이 바로 접수되며, 신청 즉시 공개 원장에 이력이 남습니다.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                      분실 신고는 별도 첨부 없이 바로 접수되며, 신청 즉시 공개 원장에 이력이 남습니다.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRiskModal}
                disabled={riskActionLoading}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleRiskAction}
                disabled={riskActionLoading}
                className={`px-6 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 ${isRiskActive(riskModalPassport) ? 'bg-slate-900 hover:bg-slate-800' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {riskActionLoading
                  ? '처리 중...'
                  : (isRiskActive(riskModalPassport)
                    ? '신고 취소하기'
                    : (riskReportType === 'STOLEN' ? '도난 신고하기' : '분실 신고하기'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {transferModalPassport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-[linear-gradient(135deg,#eff6ff,#ffffff)]">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <WalletCards className="text-blue-600" />
                디지털 자산 양도하기
              </h3>
              <button
                onClick={closeTransferModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <div className="rounded-2xl border border-blue-100 bg-[linear-gradient(145deg,#eff6ff,#f8fbff)] p-5">
                <div className="text-xs font-semibold tracking-wide text-blue-700 uppercase">양도 대상</div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white bg-white/90 px-4 py-3">
                    <div className="text-[11px] text-gray-500">시리얼 번호</div>
                    <div className="mt-1 text-lg font-bold tracking-tight text-gray-900">
                      {transferModalPassport.serialNumber || '-'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white bg-white/90 px-4 py-3">
                    <div className="text-[11px] text-gray-500">모델명</div>
                    <div className="mt-1 text-lg font-bold tracking-tight text-gray-900">
                      {transferModalPassport.modelName || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {transferCreateError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {transferCreateError}
                </div>
              )}

              {transferResolveLoading ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-6 text-center text-sm text-blue-700">
                  기존 양도 정보를 확인하는 중입니다...
                </div>
              ) : transferCompletionInfo ? (
                <div className="space-y-4 rounded-[1.75rem] border border-emerald-200 bg-[linear-gradient(160deg,#effcf6_0%,#ffffff_72%)] p-5 sm:p-6">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-[0_14px_30px_-22px_rgba(5,150,105,.7)]">
                    <CheckCircle2 size={28} />
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Transfer Completed</div>
                    <div className="text-2xl font-bold tracking-tight text-slate-900">양도가 완료되었습니다</div>
                    <p className="mx-auto max-w-xl text-sm leading-6 text-slate-600">
                      상대방이 {transferCompletionInfo.mode === 'QR' ? 'QR 스캔' : '수락코드 입력'}으로 소유권 이전을 완료했습니다.
                      디지털 자산 소유권이 즉시 반영되며, 내 자산 목록에서도 자동으로 정리됩니다.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-100 bg-white/95 px-4 py-3">
                      <div className="text-[11px] text-slate-500">시리얼 번호</div>
                      <div className="mt-1 break-all text-base font-semibold text-slate-900">
                        {transferCompletionInfo.serialNumber}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-white/95 px-4 py-3">
                      <div className="text-[11px] text-slate-500">모델명</div>
                      <div className="mt-1 break-words text-base font-semibold text-slate-900">
                        {transferCompletionInfo.modelName}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 text-sm text-slate-600">
                    <div className="font-medium text-slate-800">처리 시각</div>
                    <div className="mt-1">{new Date(transferCompletionInfo.completedAt).toLocaleString()}</div>
                  </div>

                  <button
                    type="button"
                    onClick={closeTransferModal}
                    className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_-24px_rgba(5,150,105,.85)] transition hover:bg-emerald-700"
                  >
                    확인
                  </button>
                </div>
              ) : activeTransfer ? (
                <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-base">
                    <CheckCircle2 size={16} />
                    생성된 양도 요청
                  </div>
                  <div className="text-xs text-gray-600">Transfer ID: {activeTransfer.transferId}</div>
                  <div className="text-xs text-gray-600">
                    만료 시각: {activeTransfer.expiresAt ? new Date(activeTransfer.expiresAt).toLocaleString() : '-'}
                  </div>
                  <div className="rounded-lg bg-white border border-emerald-200 px-4 py-3 text-center">
                    <div className="text-xs text-gray-500">남은 유효시간</div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">
                      {formatRemaining(new Date(activeTransfer.expiresAt).getTime() - transferNow)}
                    </div>
                  </div>

                  {activeTransfer.mode === 'QR' && transferShareQrImage && (
                    <div className="space-y-2">
                      <img
                        src={transferShareQrImage}
                        alt="양도용 1회 QR"
                        className="mx-auto h-64 w-64 rounded-lg border border-white bg-white p-2"
                      />
                      <div className="text-center text-xs text-gray-600">상대방이 이 QR을 스캔하면 이전 받기 화면으로 이동합니다.</div>
                    </div>
                  )}

                  {activeTransfer.mode === 'CODE' && (
                    <div className="space-y-2">
                      {(() => {
                        const displayReceiveCode = activeTransfer.receiveCode
                          || toReceiveCode(activeTransfer.transferId, activeTransfer.oneTimeCode);
                        return (
                          <>
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <div className="text-xs text-gray-500">수락코드</div>
                        <div className="mt-1 break-all font-mono text-base font-bold tracking-[0.18em] text-gray-900 sm:text-lg">
                          {displayReceiveCode || '보안상 재노출 불가'}
                        </div>
                      </div>
                      {displayReceiveCode && (
                        <button
                          type="button"
                          onClick={() => copyText(displayReceiveCode || '')}
                          className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
                        >
                          <Copy size={13} /> 수락코드 복사
                        </button>
                      )}
                      <div className="text-xs text-gray-600">상대방은 디지털 자산 이전받기 화면에서 수락코드만 입력하면 됩니다.</div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelTransfer}
                    className="w-full rounded-xl bg-white border border-red-300 text-red-700 py-2.5 font-semibold hover:bg-red-50"
                  >
                    양도 취소
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setTransferCreateMode('QR')}
                      className={`rounded-xl border p-5 text-left transition ${transferCreateMode === 'QR' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                    >
                      <div className="font-semibold text-base">1회용 QR 코드 (대면)</div>
                      <div className="text-xs mt-1 opacity-80">유효시간 15분</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferCreateMode('CODE')}
                      className={`rounded-xl border p-5 text-left transition ${transferCreateMode === 'CODE' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                    >
                      <div className="font-semibold text-base">onetime code (온라인)</div>
                      <div className="text-xs mt-1 opacity-80">유효시간 7일</div>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateTransfer}
                    disabled={transferCreating}
                    className="w-full rounded-xl bg-blue-600 text-white py-2.5 font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {transferCreating ? '생성 중...' : '양도 수단 생성하기'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {transferNotice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white shadow-2xl">
            <div className="px-5 py-4 border-b border-emerald-100 bg-[linear-gradient(145deg,#ecfdf5,#ffffff)]">
              <div className="text-base font-bold text-emerald-800">처리 완료</div>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700">{transferNotice}</div>
            <div className="px-5 py-4 flex justify-end border-t border-gray-100">
              <button
                type="button"
                onClick={closeTransferModal}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {copyToast && (
        <div className="fixed bottom-5 left-1/2 z-[80] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#f8fafc)] px-4 py-3 text-sm font-medium text-slate-800 shadow-[0_16px_36px_-24px_rgba(15,23,42,.75)]">
          {copyToast}
        </div>
      )}
      </div>
    </div>
  );
};

export default MyPage;
