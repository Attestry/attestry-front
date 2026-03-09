import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import useAuthStore from '../../store/useAuthStore';
import { User, Shield, FileText, Settings, Loader2, WalletCards, Copy, CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const MyPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, accessToken, myMemberships, myApplications, myAccount, fetchMyMemberships, listMyApplications, fetchMyAccount, updateMyAccount, getApplication } = useAuthStore();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return tab === 'assets' || tab === 'account' || tab === 'applications' ? tab : 'membership';
  });
  const [loading, setLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedPurchaseClaim, setSelectedPurchaseClaim] = useState(null);
  const [selectedPurchaseClaimEvidences, setSelectedPurchaseClaimEvidences] = useState([]);
  const [purchaseClaimEvidenceLoading, setPurchaseClaimEvidenceLoading] = useState(false);
  const [purchaseClaimEvidenceError, setPurchaseClaimEvidenceError] = useState('');
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
  const [copyToast, setCopyToast] = useState('');

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const transferStorageUserKey = myAccount?.userId || user?.userId || user?.id || '';

  useEffect(() => {
    const loadMyPurchaseClaims = async () => {
      if (!accessToken) {
        setMyPurchaseClaims([]);
        return;
      }
      try {
        setPurchaseClaimError('');
        const response = await fetch('/workflows/purchase-claims/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!response.ok) {
          throw new Error('디지털 자산 신청 내역을 불러오지 못했습니다.');
        }
        const data = await response.json();
        setMyPurchaseClaims(Array.isArray(data) ? data : []);
      } catch (e) {
        setPurchaseClaimError(e.message || '디지털 자산 신청 내역을 불러오지 못했습니다.');
        setMyPurchaseClaims([]);
      }
    };

    const loadData = async () => {
      setLoading(true);

      const loadMyPassports = async () => {
        if (!accessToken) {
          setMyPassports([]);
          return;
        }
        try {
          setPassportError('');
          const response = await fetch('/products/me/passports', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          if (!response.ok) {
            throw new Error('내 디지털 자산 목록을 불러오지 못했습니다.');
          }
          const data = await response.json();
          setMyPassports(Array.isArray(data) ? data : []);
        } catch (e) {
          setPassportError(e.message || '내 디지털 자산 목록을 불러오지 못했습니다.');
          setMyPassports([]);
        }
      };

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

  const fetchPendingTransfer = async (passportId) => {
    if (!passportId || !accessToken) return null;
    try {
      const response = await fetch(`/workflows/passports/${encodeURIComponent(passportId)}/transfers/pending`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 204) return null;
      if (!response.ok) return undefined;
      const data = await response.json();
      return toTransferState(data);
    } catch {
      return undefined;
    }
  };

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
    try {
      const password = transferCreateMode === 'CODE' ? generateOneTimeCode() : null;
      const body = {
        acceptMethod: transferCreateMode,
        expiresAt: buildExpiresAt(transferCreateMode),
        ...(password ? { password } : {}),
      };

      const response = await fetch(`/workflows/passports/${encodeURIComponent(transferModalPassport.passportId)}/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let detail = '';
        try {
          detail = await response.text();
        } catch {
          // noop
        }
        throw new Error(detail?.trim() || '양도 생성에 실패했습니다.');
      }

      const data = await response.json();
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
      const response = await fetch(`/workflows/transfers/${encodeURIComponent(activeTransfer.transferId)}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        let detail = '';
        try {
          detail = await response.text();
        } catch {
          // noop
        }
        throw new Error(detail?.trim() || '양도 취소에 실패했습니다.');
      }
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
      clearActiveTransfer(transferModalPassport.passportId, transferStorageUserKey);
      setActiveTransfer(null);
      setTransferCreateResult(null);
      setTransferShareQrImage('');
      setTransferCreateError('기존 양도 요청이 만료되었습니다. 새로 생성해주세요.');
    }
  }, [activeTransfer, transferNow, transferModalPassport]);

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
        const response = await fetch(`/workflows/purchase-claims/${encodeURIComponent(selectedPurchaseClaim.claimId)}/evidences`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          let detail = '';
          try {
            const text = await response.text();
            detail = text?.trim() ? ` ${text.slice(0, 140)}` : '';
          } catch {
            // noop
          }
          throw new Error(`[${response.status}] 증빙 자료 파일 조회에 실패했습니다.${detail}`);
        }
        const data = await response.json();
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
  const displayPurchaseClaims = myPurchaseClaims || [];
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
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header Section */}
      <div className="flex items-center gap-6 mb-10">
        <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
          <User size={36} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{myAccount?.email || user?.email || '사용자'}님, 안녕하세요.</h1>
          <p className="text-gray-500 mt-2 text-lg">디지털 제품 여권 생태계의 여정을 확인하세요.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="md:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${activeTab === tab.id
                  ? 'bg-gray-50 text-gray-900 font-semibold border-l-4 border-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                  }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className={`${activeTab === tab.id ? 'text-gray-900' : 'text-gray-400'}`}>
                  {tab.icon}
                </div>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
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
                    <div key={membership.membershipId} className="p-5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                      <div>
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
              <div className="flex justify-between items-center mb-6">
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
                      <div className="flex gap-2">
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
                          <div className="flex gap-2 pt-2">
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

                  {ownedPassportsSorted.length > 0 ? (
                    ownedPassportsSorted.map((passport) => (
                      <button
                        key={passport.passportId}
                        type="button"
                        onClick={() => setSelectedPassport(passport)}
                        className="w-full rounded-xl border border-blue-100 bg-blue-50/40 p-5 text-left transition-colors hover:bg-blue-50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-lg font-bold text-gray-800">{passport.serialNumber || '-'}</div>
                            <div className="mt-1 text-sm text-gray-600">모델: {passport.modelName || '-'}</div>
                            <div className="mt-1 text-xs text-gray-500 font-mono break-all">
                              Passport: {passport.passportId}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleTransferClick(e, passport)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                              양도하기
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleLedgerHistoryClick(e, passport)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              원장 이력
                            </button>
                          </div>
                        </div>
                      </button>
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
                    {purchaseClaimError && (
                      <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {purchaseClaimError}
                      </div>
                    )}
                    {displayPurchaseClaims.length > 0 ? (
                      <div className="space-y-4">
                        {displayPurchaseClaims.map((claim) => (
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
                        디지털 자산 등록 신청 내역이 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                <div>
                  <div className="text-gray-500 mb-1">사업자 등록번호</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedApp.bizRegNo}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 mb-1">증빙 자료 파일</div>
                  {selectedApp.evidenceOriginalFileName ? (
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
                        <div className="text-lg font-bold tracking-wider text-gray-900">
                          {displayReceiveCode || '보안상 재노출 불가'}
                        </div>
                      </div>
                      {displayReceiveCode && (
                        <button
                          type="button"
                          onClick={() => copyText(displayReceiveCode || '')}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
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
  );
};

export default MyPage;
