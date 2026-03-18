import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, RefreshCw } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { apiFetchJson } from '../../utils/api';
import { getCurrentMembership, hasEffectiveScope, normalizeApiErrorMessage, toPermissionMessage } from '../../utils/permissionUi';

const PAGE_SIZE = 20;
const BRANDS_PAGE_SIZE = 10;

const fetchWithAuth = async (url, options = {}) => {
  const token = useAuthStore.getState().accessToken;
  return apiFetchJson(url, options, {
    token,
    fallbackMessage: normalizeApiErrorMessage('', undefined)
  });
};

const RetailCompletedTransfersView = () => {
  const { user, myMemberships, partnerLinks, fetchPartnerLinks } = useAuthStore();
  const currentMembership = getCurrentMembership(myMemberships, user?.tenantId, 'RETAIL');
  const canReadRetailTransfers = hasEffectiveScope(currentMembership, 'TENANT_READ_ONLY');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [brandPage, setBrandPage] = useState(0);

  const brandNameMap = useMemo(() => {
    const entries = (partnerLinks || [])
      .filter((link) => link?.status === 'ACTIVE')
      .map((link) => [link.sourceTenantId, link.sourceTenantName || '이름 없는 브랜드']);
    return new Map(entries);
  }, [partnerLinks]);

  const groupedItems = useMemo(() => {
    const groups = new Map();
    items.forEach((item) => {
      const sourceTenantId = item.sourceTenantId || 'UNKNOWN';
      const current = groups.get(sourceTenantId) || {
        sourceTenantId,
        brandName: brandNameMap.get(sourceTenantId) || '알 수 없는 브랜드',
        items: [],
      };
      current.items.push(item);
      groups.set(sourceTenantId, current);
    });
    return Array.from(groups.values());
  }, [brandNameMap, items]);

  const totalBrandPages = Math.max(1, Math.ceil(groupedItems.length / BRANDS_PAGE_SIZE));
  const currentBrandPage = Math.min(brandPage, totalBrandPages - 1);
  const pagedGroups = groupedItems.slice(
    currentBrandPage * BRANDS_PAGE_SIZE,
    currentBrandPage * BRANDS_PAGE_SIZE + BRANDS_PAGE_SIZE
  );

  const requestUrl = useMemo(() => {
    if (!user?.tenantId) return '';
    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE),
    });
    return `/workflows/tenants/${encodeURIComponent(user.tenantId)}/transfers/completed?${params.toString()}`;
  }, [page, user?.tenantId]);

  const load = useCallback(async () => {
    if (!requestUrl) {
      setItems([]);
      setTotalPages(1);
      setTotalElements(0);
      setLoading(false);
      return;
    }
    if (!canReadRetailTransfers) {
      setItems([]);
      setTotalPages(1);
      setTotalElements(0);
      setLoading(false);
      setError(toPermissionMessage({ status: 403, message: 'Access denied' }, 'DEFAULT'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [data, partnerRes] = await Promise.all([
        fetchWithAuth(requestUrl),
        fetchPartnerLinks('ACTIVE'),
      ]);
      if (partnerRes?.success === false) {
        setError(partnerRes.message || '브랜드 정보를 불러오지 못했습니다.');
      }
      setItems(Array.isArray(data?.content) ? data.content : []);
      setTotalPages(Math.max(1, data?.totalPages || 1));
      setTotalElements(data?.totalElements || 0);
    } catch (e) {
      setError(toPermissionMessage(e, 'DEFAULT', '양도 완료 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [canReadRetailTransfers, fetchPartnerLinks, requestUrl]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    setBrandPage(0);
  }, [page, items.length]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">양도 완료 물품 관리</h1>
          <p className="text-gray-500 mt-1">브랜드별로 소비자 양도가 완료된 제품 이력을 확인합니다.</p>
        </div>

        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </header>

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">양도 완료 목록</h2>
          <span className="text-xs font-semibold text-gray-500">총 {totalElements}개</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-gray-500">불러오는 중...</div>
        ) : error ? (
          <div className="px-5 py-10 text-sm text-amber-800">{error}</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-sm text-gray-500">양도 완료된 제품이 없습니다.</div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {pagedGroups.map((group) => (
                <section key={group.sourceTenantId} className="px-5 py-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-green-50 text-green-700">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{group.brandName}</div>
                        <div className="text-xs text-gray-500 mt-1">Tenant ID: {group.sourceTenantId}</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-gray-500">{group.items.length}건</span>
                  </div>

                  <ul className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                    {group.items.map((item) => (
                      <li key={item.transferId} className="px-4 py-4 flex items-start justify-between gap-4 bg-gray-50/30">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{item.modelName || '-'}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Serial: {item.serialNumber || '-'} | Passport: {item.passportId}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            수령 방식: {item.acceptMethod || '-'}
                            {item.toOwnerId ? ` | 수령자: ${item.toOwnerId}` : ''}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            완료 시각: {item.completedAt ? new Date(item.completedAt).toLocaleString() : '-'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 shrink-0">
                          <CheckCircle2 size={14} />
                          양도 완료
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/60">
              <div className="flex items-center gap-6">
                <span className="text-xs text-gray-500">
                  제품 페이지 {page + 1} / {totalPages}
                </span>
                <span className="text-xs text-gray-500">
                  브랜드 페이지 {currentBrandPage + 1} / {totalBrandPages}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBrandPage((prev) => Math.max(0, prev - 1))}
                  disabled={currentBrandPage === 0}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  브랜드 이전
                </button>
                <button
                  type="button"
                  onClick={() => setBrandPage((prev) => Math.min(totalBrandPages - 1, prev + 1))}
                  disabled={currentBrandPage >= totalBrandPages - 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  브랜드 다음
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  제품 이전
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  제품 다음
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default RetailCompletedTransfersView;
