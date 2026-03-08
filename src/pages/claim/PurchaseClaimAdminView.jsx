import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
  Search,
  History,
  ListChecks,
  Filter,
  Paperclip,
  ExternalLink,
  FileText,
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

const parseErrorMessage = async (response) => {
  const prefix = `[${response.status}]`;
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      const data = await response.json();
      const message = data?.message || data?.error || data?.code || data?.path;
      return message ? `${prefix} ${message}` : `${prefix} 요청 처리에 실패했습니다.`;
    }

    const text = await response.text();
    if (text && text.trim()) {
      return `${prefix} ${text.slice(0, 160)}`;
    }
    return `${prefix} 요청 처리에 실패했습니다.`;
  } catch {
    return `${prefix} 요청 처리에 실패했습니다.`;
  }
};

const apiJson = async (url, token, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  if (response.status === 204) return null;
  return response.json();
};

const toDateTime = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const shortId = (value) => {
  if (!value) return '-';
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

const inDateRange = (targetIso, from, to) => {
  if (!targetIso) return true;
  const t = new Date(targetIso).getTime();
  if (Number.isNaN(t)) return true;

  if (from) {
    const fromTs = new Date(`${from}T00:00:00`).getTime();
    if (t < fromTs) return false;
  }
  if (to) {
    const toTs = new Date(`${to}T23:59:59.999`).getTime();
    if (t > toTs) return false;
  }
  return true;
};

const statusPillClass = (status) => {
  if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'REJECTED') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const evidenceExpiryMeta = (expiresAt) => {
  if (!expiresAt) {
    return {
      label: '만료 정보 없음',
      className: 'border-slate-300 bg-slate-100 text-slate-600',
    };
  }

  const remainMs = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(remainMs)) {
    return {
      label: '만료 시간 파싱 실패',
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }
  if (remainMs <= 0) {
    return {
      label: '만료됨',
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }

  const hours = Math.floor(remainMs / (1000 * 60 * 60));
  if (hours < 24) {
    return {
      label: `만료 임박 ${hours}h`,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  const days = Math.floor(hours / 24);
  return {
    label: `유효 ${days}일`,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
};

const DataField = ({ label, value, mono = false }) => (
  <div className="space-y-1 min-w-0">
    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
    <p className={`text-sm text-slate-700 ${mono ? 'font-mono text-xs' : 'font-medium'} break-all`}>{value || '-'}</p>
  </div>
);

const PurchaseClaimAdminView = () => {
  const { accessToken, user } = useAuthStore();
  const tenantId = (user?.tenantId || '').trim();
  const storageKey = React.useMemo(() => `purchase_claim_admin_history_${tenantId || 'unknown'}`, [tenantId]);

  const [claims, setClaims] = React.useState([]);
  const [historyEntries, setHistoryEntries] = React.useState([]);
  const [selectedClaim, setSelectedClaim] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [rejectReason, setRejectReason] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('pending');
  const [filters, setFilters] = React.useState({
    serial: '',
    claimant: '',
    dateFrom: '',
    dateTo: '',
  });
  const [evidences, setEvidences] = React.useState([]);
  const [evidenceLoading, setEvidenceLoading] = React.useState(false);
  const [evidenceError, setEvidenceError] = React.useState('');
  const [modal, setModal] = React.useState({ open: false, title: '', message: '', tone: 'success' });

  const openModal = React.useCallback((title, message, tone = 'success') => {
    setModal({ open: true, title, message, tone });
  }, []);

  React.useEffect(() => {
    if (!tenantId) {
      setHistoryEntries([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setHistoryEntries(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistoryEntries([]);
    }
  }, [storageKey, tenantId]);

  const persistHistory = React.useCallback((next) => {
    setHistoryEntries(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // noop
    }
  }, [storageKey]);

  const appendHistory = React.useCallback((claim, status, reason = null) => {
    const nextEntry = {
      claimId: claim.claimId,
      claimantUserId: claim.claimantUserId,
      serialNumber: claim.serialNumber,
      modelName: claim.modelName,
      submittedAt: claim.submittedAt,
      status,
      rejectionReason: reason,
      processedAt: new Date().toISOString(),
    };
    persistHistory([nextEntry, ...historyEntries]);
  }, [historyEntries, persistHistory]);

  const loadPendingClaims = React.useCallback(async () => {
    setError('');
    setSuccess('');
    if (!accessToken) {
      setError('로그인이 필요합니다.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiJson('/workflows/purchase-claims/pending', accessToken);
      const nextClaims = Array.isArray(data) ? data : [];
      setClaims(nextClaims);
      setSelectedClaim((prev) => (prev ? nextClaims.find((c) => c.claimId === prev.claimId) || null : prev));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const loadClaimEvidences = React.useCallback(async (claimId) => {
    if (!claimId || !accessToken) {
      setEvidences([]);
      return;
    }

    setEvidenceLoading(true);
    setEvidenceError('');
    try {
      const data = await apiJson(
        `/workflows/purchase-claims/${encodeURIComponent(claimId)}/admin-evidences`,
        accessToken
      );
      setEvidences(Array.isArray(data) ? data : []);
    } catch (e) {
      setEvidenceError(e.message);
      setEvidences([]);
    } finally {
      setEvidenceLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    if (accessToken) {
      loadPendingClaims();
    }
  }, [accessToken, loadPendingClaims]);

  React.useEffect(() => {
    if (!accessToken) return undefined;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && activeTab === 'pending' && !processing) {
        loadPendingClaims();
      }
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [accessToken, activeTab, processing, loadPendingClaims]);

  React.useEffect(() => {
    if (!accessToken) return undefined;
    const onFocus = () => {
      if (activeTab === 'pending') {
        loadPendingClaims();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && activeTab === 'pending') {
        loadPendingClaims();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [accessToken, activeTab, loadPendingClaims]);

  React.useEffect(() => {
    setRejectReason('');
    if (!selectedClaim?.claimId) {
      setEvidences([]);
      setEvidenceError('');
      setEvidenceLoading(false);
      return;
    }
    loadClaimEvidences(selectedClaim.claimId);
  }, [selectedClaim, loadClaimEvidences]);

  const handleApprove = async () => {
    setError('');
    setSuccess('');
    if (!selectedClaim) return;

    setProcessing(true);
    try {
      await apiJson(
        `/workflows/purchase-claims/${selectedClaim.claimId}/approve`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify({
            manufacturedAt: new Date().toISOString(),
            productionBatch: null,
            factoryCode: null,
          }),
        }
      );
      appendHistory(selectedClaim, 'APPROVED', null);
      setSuccess('신청을 승인했습니다.');
      openModal('등록 승인 완료', `신청건 ${shortId(selectedClaim.claimId)} 처리가 완료되었습니다.`);
      setSelectedClaim(null);
      setRejectReason('');
      await loadPendingClaims();
      setActiveTab('history');
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setError('');
    setSuccess('');
    if (!selectedClaim) return;
    if (!rejectReason.trim()) {
      openModal('입력 필요', '반려 사유를 입력해주세요.', 'alert');
      return;
    }

    setProcessing(true);
    try {
      await apiJson(
        `/workflows/purchase-claims/${selectedClaim.claimId}/reject`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify({ reason: rejectReason.trim() }),
        }
      );
      appendHistory(selectedClaim, 'REJECTED', rejectReason.trim());
      setSuccess('신청을 반려했습니다. 반려 사유는 신청자 화면에 표시됩니다.');
      openModal('반려 처리 완료', '반려 사유가 신청자에게 전달되었습니다.');
      setSelectedClaim(null);
      setRejectReason('');
      await loadPendingClaims();
      setActiveTab('history');
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredPending = React.useMemo(() => {
    return claims.filter((item) => {
      const matchSerial = !filters.serial || (item.serialNumber || '').toLowerCase().includes(filters.serial.toLowerCase());
      const matchClaimant = !filters.claimant || (item.claimantUserId || '').toLowerCase().includes(filters.claimant.toLowerCase());
      const matchDate = inDateRange(item.submittedAt, filters.dateFrom, filters.dateTo);
      return matchSerial && matchClaimant && matchDate;
    });
  }, [claims, filters]);

  const filteredHistory = React.useMemo(() => {
    return historyEntries.filter((item) => {
      const matchSerial = !filters.serial || (item.serialNumber || '').toLowerCase().includes(filters.serial.toLowerCase());
      const matchClaimant = !filters.claimant || (item.claimantUserId || '').toLowerCase().includes(filters.claimant.toLowerCase());
      const matchDate = inDateRange(item.processedAt || item.submittedAt, filters.dateFrom, filters.dateTo);
      return matchSerial && matchClaimant && matchDate;
    });
  }, [historyEntries, filters]);

  const resetFilters = () => {
    setFilters({ serial: '', claimant: '', dateFrom: '', dateTo: '' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 [font-family:var(--admin-font,ui-sans-serif,system-ui)]">
      <header className="rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_10%_10%,rgba(148,163,184,.24),transparent_42%),linear-gradient(135deg,#0f172a,#1e293b_55%,#334155)] p-6 md:p-8 text-white shadow-[0_24px_60px_-28px_rgba(15,23,42,.7)]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">디지털 자산 등록 신청 관리</h1>
            <p className="text-slate-200 mt-2 text-sm md:text-base">디지털 자산 등록을 승인/ 반려 하세요.</p>
          </div>
          <button
            onClick={loadPendingClaims}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-800 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
            aria-label="신청 목록 새로고침"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {loading ? '불러오는 중...' : '신청 목록 새로고침'}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2" role="alert" aria-live="assertive">
          <AlertCircle size={16} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2" role="status" aria-live="polite">
          <CheckCircle2 size={16} className="mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">승인 대기</p>
            <Clock3 size={18} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{claims.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">이력 건수</p>
            <History size={18} className="text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{historyEntries.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">선택된 신청</p>
            <ShieldCheck size={18} className="text-blue-600" />
          </div>
          <p className="text-sm font-semibold text-slate-900 mt-2">{selectedClaim ? shortId(selectedClaim.claimId) : '없음'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">처리 상태</p>
            <CheckCircle2 size={18} className={processing ? 'text-slate-400' : 'text-emerald-600'} />
          </div>
          <p className="text-sm font-semibold text-slate-900 mt-2">{processing ? '처리 중' : '대기'}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-700">
          <Filter size={16} />
          <h2 className="font-semibold">검색 / 필터</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">시리얼</span>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.serial}
                onChange={(e) => setFilters((p) => ({ ...p, serial: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-700"
                placeholder="예: SN-001"
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">신청자</span>
            <input
              type="text"
              value={filters.claimant}
              onChange={(e) => setFilters((p) => ({ ...p, claimant: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-700"
              placeholder="사용자 ID"
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">기간 시작</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-700"
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">기간 종료</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-700"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button onClick={resetFilters} className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
            필터 초기화
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === 'pending' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-300'}`}
            >
              <ListChecks size={14} /> 승인 대기 신청 목록
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === 'history' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-300'}`}
            >
              <History size={14} /> 승인/반려 이력
            </button>
          </div>

          <div className="p-4 md:p-6 space-y-3">
            {activeTab === 'pending' ? (
              loading ? (
                <div className="p-6 text-sm text-slate-500">데이터를 불러오는 중입니다...</div>
              ) : filteredPending.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <p className="text-slate-700 font-medium">승인 대기 신청이 없습니다.우측 상단 새로고침 버튼을 눌러주세요.</p>
                </div>
              ) : (
                filteredPending.map((claim) => {
                  const active = selectedClaim?.claimId === claim.claimId;
                  return (
                    <article key={claim.claimId} className={`rounded-2xl border p-4 transition-all duration-200 ${active ? 'border-sky-300 bg-sky-50/50 shadow-[0_10px_24px_-18px_rgba(2,132,199,.9)]' : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 hover:shadow-[0_10px_24px_-20px_rgba(15,23,42,.65)]'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <DataField label="Claim ID" value={shortId(claim.claimId)} mono />
                        <DataField label="신청자" value={claim.claimantUserId} />
                        <DataField label="신청일시" value={toDateTime(claim.submittedAt)} />
                        <DataField label="시리얼" value={claim.serialNumber} />
                        <DataField label="모델" value={claim.modelName} />
                        <div className="flex md:justify-end lg:justify-start items-end">
                          <button
                            onClick={() => {
                              setSelectedClaim(claim);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100"
                          >
                            선택
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )
            ) : filteredHistory.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                <p className="text-slate-700 font-medium">조건에 맞는 이력이 없습니다.</p>
                <p className="text-xs text-slate-500 mt-1">현재 이력은 화면에서 처리한 내역을 tenant별로 저장합니다.</p>
              </div>
            ) : (
              filteredHistory.map((item) => (
                <article key={`${item.claimId}-${item.processedAt}`} className="rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition-colors">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <DataField label="Claim ID" value={shortId(item.claimId)} mono />
                    <DataField label="신청자" value={item.claimantUserId} />
                    <DataField label="처리일시" value={toDateTime(item.processedAt)} />
                    <DataField label="시리얼" value={item.serialNumber} />
                    <DataField label="모델" value={item.modelName} />
                    <div className="space-y-1 min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">결과</p>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">반려 사유</p>
                      <p className="text-sm text-slate-600 break-words">{item.rejectionReason || '-'}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">선택한 신청 처리</h3>
              <p className="text-xs text-slate-500 mt-1">승인 대기 탭에서 선택한 항목만 처리할 수 있습니다.</p>
            </div>
            {selectedClaim && (
              <button
                onClick={() => {
                  setSelectedClaim(null);
                  setRejectReason('');
                }}
                className="text-slate-400 hover:text-slate-600"
                title="선택 해제"
              >
                <XCircle size={18} />
              </button>
            )}
          </div>

          {activeTab !== 'pending' ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-slate-500 text-sm">
              승인/반려 처리는 "승인 대기 신청 목록" 탭에서 가능합니다.
            </div>
          ) : !selectedClaim ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-slate-500 text-sm">
              처리할 신청을 목록에서 선택해주세요.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <UserRound size={14} />
                  <span className="font-medium break-all">{selectedClaim.claimantUserId}</span>
                </div>
                <div className="text-slate-600">Claim: <span className="font-mono text-xs break-all">{selectedClaim.claimId}</span></div>
                <div className="text-slate-600">Serial: <span className="font-semibold text-slate-800">{selectedClaim.serialNumber}</span></div>
                <div className="text-slate-600">Model: <span className="font-semibold text-slate-800">{selectedClaim.modelName}</span></div>
              </div>

              <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
                    <Paperclip size={14} />
                    첨부 증빙
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{evidences.length}건</span>
                    <button
                      type="button"
                      onClick={() => selectedClaim?.claimId && loadClaimEvidences(selectedClaim.claimId)}
                      disabled={evidenceLoading || !selectedClaim?.claimId}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={evidenceLoading ? 'animate-spin' : ''} />
                      재조회
                    </button>
                  </div>
                </div>

                {evidenceLoading ? (
                  <div className="text-sm text-slate-500 py-2">첨부파일을 불러오는 중입니다...</div>
                ) : evidenceError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    첨부파일 조회 실패: {evidenceError}
                  </div>
                ) : evidences.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500 text-center">
                    등록된 증빙 파일이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {evidences.map((file) => {
                      const expiry = evidenceExpiryMeta(file.expiresAt);
                      return (
                        <div key={file.evidenceId} className="rounded-lg border border-slate-200 px-3 py-2.5 bg-slate-50/60">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 break-all">{file.evidenceId}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                EVIDENCE
                              </span>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${expiry.className}`}>
                                {expiry.label}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {file.downloadUrl ? (
                              <a
                                href={file.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                <FileText size={13} />
                                다운로드
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700">
                                링크 생성 실패
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500">
                              {file.downloadUrl ? `만료: ${toDateTime(file.expiresAt)}` : (file.errorMessage || '파일 링크를 생성하지 못했습니다.')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <button
                onClick={handleApprove}
                disabled={processing}
                className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {processing ? '처리 중...' : '신청 승인'}
              </button>

              <div className="border-t border-slate-200 pt-4 space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="rejectReason">반려 사유</label>
                <textarea
                  id="rejectReason"
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-700"
                  placeholder="신청자에게 보여줄 반려 사유를 입력하세요"
                />
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="w-full px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
                >
                  {processing ? '처리 중...' : '신청 반려'}
                </button>
              </div>
            </>
          )}
        </aside>
      </section>

      {modal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="min-h-full flex items-center justify-center">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,.7)] p-6">
              <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center mb-4 ${modal.tone === 'alert' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                {modal.tone === 'alert' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <h3 className="text-lg font-bold text-slate-900">{modal.title}</h3>
              <p className="text-sm text-slate-600 mt-2">{modal.message}</p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setModal({ open: false, title: '', message: '', tone: 'success' })}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 text-white text-sm font-semibold"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseClaimAdminView;
