import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, CheckCircle2, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { apiFetchJson } from '../../utils/api';
import { normalizeApiErrorMessage } from '../../utils/permissionUi';

const PAGE_SIZE = 20;

const fetchWithAuth = async (url, options = {}) => {
  const token = useAuthStore.getState().accessToken;
  return apiFetchJson(url, options, {
    token,
    fallbackMessage: normalizeApiErrorMessage('', undefined, '양도 완료 목록을 불러오지 못했습니다.')
  });
};

const RetailBrandCompletedTransfersDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { brandTenantId } = useParams();
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const brandName = location.state?.brandName || '브랜드';
  const partnerLinkId = location.state?.partnerLinkId || '-';

  const requestUrl = useMemo(() => {
    if (!user?.tenantId || !brandTenantId) return '';
    const params = new URLSearchParams({
      page: String(page),
      size: String(PAGE_SIZE),
      sourceTenantId: brandTenantId,
    });
    return `/workflows/tenants/${encodeURIComponent(user.tenantId)}/transfers/completed?${params.toString()}`;
  }, [brandTenantId, page, user?.tenantId]);

  const load = async () => {
    if (!requestUrl) {
      setItems([]);
      setTotalPages(1);
      setTotalElements(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await fetchWithAuth(requestUrl);
      setItems(Array.isArray(data?.content) ? data.content : []);
      setTotalPages(Math.max(1, data?.totalPages || 1));
      setTotalElements(data?.totalElements || 0);
    } catch (e) {
      setError(e?.message || '양도 완료 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, [requestUrl]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/retail/transfer')}
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
              <p className="mt-1 break-all text-sm text-gray-500">Tenant ID: {brandTenantId}</p>
              <p className="mt-1 break-all text-xs text-gray-400">PartnerLink: {partnerLinkId}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => load()}
          className="inline-flex w-full items-center justify-center gap-2 px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium hover:bg-gray-50 md:w-auto"
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
          <div className="px-5 py-10 text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-sm text-gray-500">이 브랜드에서 양도 완료된 제품이 없습니다.</div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {items.map((item) => (
                <li key={item.transferId} className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <button
                    type="button"
                    onClick={() => navigate(`/retail/products/${item.passportId}`, {
                      state: {
                        brandName,
                        brandTenantId,
                        detailMode: 'completed-transfer',
                        from: `/retail/transfer/${brandTenantId}`,
                      },
                    })}
                    className="min-w-0 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="text-sm font-semibold text-gray-900 break-words">{item.modelName || '-'}</div>
                    <div className="mt-1 break-all text-xs text-gray-500">
                      Serial: {item.serialNumber || '-'} | Passport: {item.passportId}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      수령 방식: {item.acceptMethod || '-'}
                      {item.toOwnerId ? ` | 수령자: ${item.toOwnerId}` : ''}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      완료 시각: {item.completedAt ? new Date(item.completedAt).toLocaleString() : '-'}
                    </div>
                  </button>
                  <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 shrink-0">
                    <CheckCircle2 size={14} />
                    양도 완료
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-5 py-4 border-t border-gray-100 flex flex-col gap-3 bg-gray-50/60 sm:flex-row sm:items-center sm:justify-between">
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
  );
};

export default RetailBrandCompletedTransfersDetail;
