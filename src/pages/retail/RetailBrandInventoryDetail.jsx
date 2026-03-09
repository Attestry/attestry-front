import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Copy, Package, QrCode, RefreshCw, Search, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useAuthStore, { TENANT_ROLES } from '../../store/useAuthStore';

const PRODUCTS_PAGE_SIZE = 20;

const fetchWithAuth = async (url, options = {}) => {
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let errorMsg = `API Error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData.message || errorMsg;
    } catch (e) {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }
  return response.status === 204 ? null : response.json();
};

const buildExpiresAt = (mode) => {
  const now = Date.now();
  const ms = mode === 'QR' ? 15 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return new Date(now + ms).toISOString();
};

const generateOneTimeCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
};

const transferStorageKey = (tenantId, passportId) => `retail_active_transfer_${tenantId}_${passportId}`;

const readActiveTransfer = (tenantId, passportId) => {
  if (!tenantId || !passportId) return null;
  try {
    const raw = localStorage.getItem(transferStorageKey(tenantId, passportId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(transferStorageKey(tenantId, passportId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const saveActiveTransfer = (tenantId, passportId, value) => {
  if (!tenantId || !passportId || !value) return;
  localStorage.setItem(transferStorageKey(tenantId, passportId), JSON.stringify(value));
};

const clearActiveTransfer = (tenantId, passportId) => {
  if (!tenantId || !passportId) return;
  localStorage.removeItem(transferStorageKey(tenantId, passportId));
};

const toReceiveCode = (transferId, oneTimeCode) => {
  if (!transferId || !oneTimeCode) return '';
  try {
    const tid = String(transferId).trim().toLowerCase();
    const code = String(oneTimeCode).trim().toUpperCase();
    const uuidHex = tid.replace(/-/g, '');
    if (/^[0-9a-f]{32}$/.test(uuidHex) && code.length === 8) {
      const bytes = new Uint8Array(24);
      for (let i = 0; i < 16; i += 1) bytes[i] = parseInt(uuidHex.slice(i * 2, i * 2 + 2), 16);
      for (let i = 0; i < 8; i += 1) bytes[16 + i] = code.charCodeAt(i);
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

const toTransferState = (data, oneTimeCode = null) => {
  const mode = String(data?.acceptMethod || data?.mode || '').toUpperCase() || 'QR';
  return {
    ...data,
    mode,
    oneTimeCode,
    receiveCode: toReceiveCode(data?.transferId, oneTimeCode),
    shareUrl: mode === 'QR'
      ? `${window.location.origin}/t/${encodeURIComponent(data.transferId)}/${encodeURIComponent(data.qrNonce || '')}`
      : `${window.location.origin}/t/${encodeURIComponent(data.transferId)}`,
  };
};

const getDisplayReceiveCode = (transfer) => {
  if (!transfer) return '';
  return transfer.receiveCode || toReceiveCode(transfer.transferId, transfer.oneTimeCode);
};

const RetailBrandInventoryDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { brandTenantId } = useParams();
  const { user, myMemberships } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [transferMode, setTransferMode] = useState('QR');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferResolveLoading, setTransferResolveLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferResult, setTransferResult] = useState(null);
  const [transferCancelLoading, setTransferCancelLoading] = useState(false);
  const [transferNow, setTransferNow] = useState(Date.now());

  const brandName = location.state?.brandName || '브랜드';
  const partnerLinkId = location.state?.partnerLinkId || '-';

  const currentRetailMembership = user?.tenantId
    ? (myMemberships || []).find((m) =>
        m.tenantId === user.tenantId
        && String(m.status).toUpperCase() === 'ACTIVE'
        && String(m.groupType).toUpperCase() === 'RETAIL'
      )
    : null;

  const membershipRoleCodes = (currentRetailMembership?.roleCodes || []).map((roleCode) => String(roleCode).toUpperCase());
  const canCreateTransfer = membershipRoleCodes.includes(TENANT_ROLES.ADMIN) || membershipRoleCodes.includes(TENANT_ROLES.OPERATOR);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(PRODUCTS_PAGE_SIZE),
      sourceTenantId: brandTenantId || '',
    });
    if (searchTerm.trim()) {
      params.set('keyword', searchTerm.trim());
    }
    return `/products/tenant/distributed-passports?${params.toString()}`;
  }, [brandTenantId, page, searchTerm]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, brandTenantId]);

  useEffect(() => {
    if (!brandTenantId) {
      setError('브랜드 정보가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      fetchWithAuth(requestUrl)
        .then((data) => {
          if (!mounted) return;
          setProducts(Array.isArray(data?.content) ? data.content : []);
          setTotalPages(Math.max(1, data?.totalPages || 1));
          setTotalElements(data?.totalElements || 0);
          setLoading(false);
        })
        .catch((e) => {
          if (!mounted) return;
          setError(e?.message || '제품 목록을 불러오지 못했습니다.');
          setLoading(false);
        });
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [brandTenantId, requestUrl]);

  const closeTransferModal = () => {
    setSelectedProduct(null);
    setTransferMode('QR');
    setTransferLoading(false);
    setTransferResolveLoading(false);
    setTransferError('');
    setTransferResult(null);
    setTransferCancelLoading(false);
  };

  const fetchPendingTransfer = async (passportId) => {
    if (!passportId || !user?.tenantId) return null;
    try {
      const response = await fetchWithAuth(
        `/workflows/tenants/${encodeURIComponent(user.tenantId)}/passports/${encodeURIComponent(passportId)}/transfers/pending`
      );
      if (!response) return null;
      return toTransferState(response);
    } catch (e) {
      if (String(e?.message || '').includes('API Error: 204')) return null;
      return undefined;
    }
  };

  const openTransferModal = async (product) => {
    if (!canCreateTransfer) return;
    setSelectedProduct(product);
    setTransferMode('QR');
    setTransferError('');
    setTransferResult(null);
    setTransferCancelLoading(false);
    setTransferResolveLoading(true);

    const serverExisting = await fetchPendingTransfer(product.passportId);
    const localExisting = readActiveTransfer(user?.tenantId, product.passportId);
    const existing = serverExisting === undefined
      ? localExisting
      : (serverExisting
          ? (serverExisting.mode === 'CODE'
              && localExisting?.mode === 'CODE'
              && localExisting?.transferId === serverExisting.transferId
              ? { ...serverExisting, oneTimeCode: localExisting.oneTimeCode || null }
              : serverExisting)
          : null);

    if (existing) {
      const hydratedExisting = existing.mode === 'CODE'
        ? { ...existing, receiveCode: getDisplayReceiveCode(existing) }
        : existing;
      setTransferResult(hydratedExisting);
      setTransferMode(hydratedExisting?.mode || 'QR');
      saveActiveTransfer(user?.tenantId, product.passportId, hydratedExisting);
    } else {
      setTransferResult(null);
      setTransferMode('QR');
      clearActiveTransfer(user?.tenantId, product.passportId);
    }

    setTransferResolveLoading(false);
  };

  const handleCancelTransfer = async () => {
    if (!transferResult?.transferId || transferCancelLoading) return;

    setTransferCancelLoading(true);
    setTransferError('');
    try {
      await fetchWithAuth(`/workflows/transfers/${encodeURIComponent(transferResult.transferId)}/cancel`, {
        method: 'POST',
      });
      clearActiveTransfer(user?.tenantId, selectedProduct?.passportId);
      setTransferResult(null);
      setTransferMode('QR');
    } catch (e) {
      setTransferError(e?.message || '양도 취소에 실패했습니다.');
    } finally {
      setTransferCancelLoading(false);
    }
  };

  const handleCreateTransfer = async () => {
    if (!selectedProduct?.passportId || !user?.tenantId || transferLoading) return;

    setTransferLoading(true);
    setTransferError('');
    setTransferResult(null);
    setTransferCancelLoading(false);

    try {
      const oneTimeCode = transferMode === 'CODE' ? generateOneTimeCode() : null;
      const payload = {
        acceptMethod: transferMode,
        expiresAt: buildExpiresAt(transferMode),
        ...(oneTimeCode ? { password: oneTimeCode } : {}),
      };

      const data = await fetchWithAuth(
        `/workflows/tenants/${encodeURIComponent(user.tenantId)}/passports/${encodeURIComponent(selectedProduct.passportId)}/transfers`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      const result = toTransferState({ ...data, acceptMethod: transferMode }, oneTimeCode);
      setTransferResult(result);
      saveActiveTransfer(user.tenantId, selectedProduct.passportId, result);
    } catch (e) {
      const message = e?.message || '양도 수단을 생성하지 못했습니다.';
      if (message.includes('TRANSFER_ALREADY_PENDING') || message.includes('pending transfer already exists')) {
        const pending = await fetchPendingTransfer(selectedProduct.passportId);
        const localExisting = readActiveTransfer(user?.tenantId, selectedProduct.passportId);
        const existing = pending === undefined
          ? localExisting
          : (pending
              ? (pending.mode === 'CODE'
                  && localExisting?.mode === 'CODE'
                  && localExisting?.transferId === pending.transferId
                  ? { ...pending, oneTimeCode: localExisting.oneTimeCode || null }
                  : pending)
              : null);
        if (existing) {
          const hydratedExisting = existing.mode === 'CODE'
            ? { ...existing, receiveCode: getDisplayReceiveCode(existing) }
            : existing;
          setTransferResult(hydratedExisting);
          setTransferMode(hydratedExisting.mode || 'QR');
          saveActiveTransfer(user?.tenantId, selectedProduct.passportId, hydratedExisting);
          setTransferError('');
          setTransferLoading(false);
          return;
        }
      }
      setTransferError(message);
    } finally {
      setTransferLoading(false);
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

  useEffect(() => {
    if (!transferResult?.expiresAt || !selectedProduct?.passportId) return undefined;

    const sync = async () => {
      setTransferNow(Date.now());
      if (new Date(transferResult.expiresAt).getTime() <= Date.now()) {
        clearActiveTransfer(user?.tenantId, selectedProduct.passportId);
        setTransferResult(null);
        setTransferMode('QR');
        return;
      }

      const pending = await fetchPendingTransfer(selectedProduct.passportId);
      if (pending === null) {
        clearActiveTransfer(user?.tenantId, selectedProduct.passportId);
        setTransferResult(null);
        setTransferMode('QR');
        fetchWithAuth(requestUrl)
          .then((data) => {
            setProducts(Array.isArray(data?.content) ? data.content : []);
            setTotalPages(Math.max(1, data?.totalPages || 1));
            setTotalElements(data?.totalElements || 0);
          })
          .catch(() => {});
      }
    };

    sync().catch(() => {});
    const timer = window.setInterval(() => {
      sync().catch(() => {});
    }, 1000);
    return () => window.clearInterval(timer);
  }, [requestUrl, selectedProduct, transferResult?.expiresAt, transferResult?.transferId, user?.tenantId]);

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      window.alert('복사했습니다.');
    } catch {
      window.alert('복사에 실패했습니다.');
    }
  };

  return (
    <>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate('/retail/inventory')}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              <ArrowLeft size={16} />
              브랜드 목록으로
            </button>
            <div className="mt-4 flex items-start gap-3">
              <div className="p-3 rounded-xl bg-green-50 text-green-700">
                <Building2 size={18} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{brandName}</h1>
                <p className="text-sm text-gray-500 mt-1">Tenant ID: {brandTenantId}</p>
                <p className="text-xs text-gray-400 mt-1">PartnerLink: {partnerLinkId}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError('');
              fetchWithAuth(requestUrl)
                .then((data) => {
                  setProducts(Array.isArray(data?.content) ? data.content : []);
                  setTotalPages(Math.max(1, data?.totalPages || 1));
                  setTotalElements(data?.totalElements || 0);
                })
                .catch((e) => setError(e?.message || '제품 목록을 불러오지 못했습니다.'))
                .finally(() => setLoading(false));
            }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            새로고침
          </button>
        </header>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="모델명 또는 시리얼 검색"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
            />
          </div>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">보유 제품 목록</h2>
            <span className="text-xs font-semibold text-gray-500">총 {totalElements}개</span>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-sm text-gray-500">불러오는 중...</div>
          ) : error ? (
            <div className="px-5 py-10 text-sm text-red-600">{error}</div>
          ) : products.length === 0 ? (
            <div className="px-5 py-10 text-sm text-gray-500">이 브랜드에서 보유 중인 제품이 없습니다.</div>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {products.map((product) => (
                  <li key={product.passportId} className="px-5 py-4 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/retail/products/${product.passportId}`, {
                        state: {
                          brandName,
                          brandTenantId,
                          from: `/retail/inventory/${brandTenantId}`,
                        },
                      })}
                      className="min-w-0 text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="text-sm font-semibold text-gray-900 truncate">{product.modelName || '-'}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Serial: {product.serialNumber || '-'} | Passport: {product.passportId}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Permission: {product.permissionStatus}
                        {product.expiresAt ? ` | 만료 ${new Date(product.expiresAt).toLocaleString()}` : ''}
                      </div>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Package size={14} />
                        <span>{product.assetState || '-'}</span>
                      </div>
                      {canCreateTransfer && (
                        <button
                          type="button"
                          onClick={() => openTransferModal(product)}
                          className="px-3 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
                        >
                          양도하기
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/60">
                <span className="text-xs text-gray-500">
                  페이지 {page + 1} / {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">디지털 자산 양도하기</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedProduct.modelName || '-'} / {selectedProduct.serialNumber || '-'}</p>
              </div>
              <button type="button" onClick={closeTransferModal} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {transferError && (
                <div className="px-4 py-3 rounded-lg bg-red-50 text-sm text-red-600 border border-red-100">{transferError}</div>
              )}

              {transferResolveLoading ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-sm text-gray-500">기존 양도 수단을 확인하는 중...</div>
              ) : transferResult ? (
                <div className="space-y-4">
                  {transferResult.mode === 'QR' ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 p-5">
                      <QrCode className="text-green-600" size={18} />
                      <QRCodeSVG value={transferResult.shareUrl} size={180} />
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-gray-200 p-5">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">수락코드</div>
                        <div className="text-lg font-bold tracking-wider text-gray-900 break-all">{getDisplayReceiveCode(transferResult) || '보안상 재노출 불가'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Transfer ID</div>
                        <div className="text-sm font-mono text-gray-700 break-all">{transferResult.transferId}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(getDisplayReceiveCode(transferResult) || '')}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                      >
                        <Copy size={14} />
                        수락코드 복사
                      </button>
                    </div>
                  )}

                  <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="text-xs text-gray-500">
                      만료 시각: {transferResult.expiresAt ? new Date(transferResult.expiresAt).toLocaleString() : '-'}
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      남은 시간: {transferResult.expiresAt ? formatRemaining(new Date(transferResult.expiresAt).getTime() - transferNow) : '-'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelTransfer}
                    disabled={transferCancelLoading}
                    className="w-full px-4 py-3 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 disabled:opacity-60"
                  >
                    {transferCancelLoading ? '취소 중...' : '양도 취소'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTransferMode('QR')}
                      className={`rounded-xl border px-4 py-4 text-left ${transferMode === 'QR' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-700'}`}
                    >
                      <div className="font-semibold">QR 양도 (대면)</div>
                      <div className="text-xs mt-1">유효시간 15분</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferMode('CODE')}
                      className={`rounded-xl border px-4 py-4 text-left ${transferMode === 'CODE' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-700'}`}
                    >
                      <div className="font-semibold">코드 양도 (비대면)</div>
                      <div className="text-xs mt-1">유효시간 7일</div>
                    </button>
                  </div>

                  <div className="text-sm text-gray-500">QR은 15분, 코드는 7일 동안 유효합니다.</div>

                  <button
                    type="button"
                    onClick={handleCreateTransfer}
                    disabled={transferLoading}
                    className="w-full px-4 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
                  >
                    {transferLoading ? '생성 중...' : '양도 수단 생성하기'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RetailBrandInventoryDetail;
