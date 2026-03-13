import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import ServicePassportDetailModal from './ServicePassportDetailModal';
import {
  hasServiceViewPermission,
  SERVICE_STATUS_META,
  SERVICE_VIEW_PERMISSION_GUIDE,
  fetchProviderRequests,
  formatDateTime,
  SERVICE_REQUEST_METHOD_META,
  SERVICE_TYPE_META,
  hasServiceManagePermission,
  toServiceErrorMessage,
} from './serviceApi';

const PAGE_SIZE = 20;
const STATUS_TABS = ['COMPLETED', 'REJECTED', 'CANCELLED'];

const ServiceHistoryPage = () => {
  const location = useLocation();
  const { user, myMemberships } = useAuthStore();
  const canViewService = hasServiceViewPermission(myMemberships, user?.tenantId);
  const canManageService = hasServiceManagePermission(myMemberships, user?.tenantId);
  const [activeStatus, setActiveStatus] = useState(location.state?.activeStatus || 'COMPLETED');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [detailPassportId, setDetailPassportId] = useState('');
  const notice = location.state?.notice || '';
  const selectedPassportId = location.state?.selectedPassportId || '';

  const load = async (status = activeStatus, pageNum = page) => {
    if (!user?.tenantId) return;
    if (!canViewService) {
      setItems([]);
      setTotalPages(1);
      setTotalElements(0);
      setPage(0);
      setLoading(false);
      setError(SERVICE_VIEW_PERMISSION_GUIDE);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchProviderRequests(user.tenantId, status, pageNum, PAGE_SIZE);
      setItems(Array.isArray(data?.content) ? data.content : []);
      setTotalPages(Math.max(1, data?.totalPages || 1));
      setTotalElements(data?.totalElements || 0);
      setPage(pageNum);
    } catch (e) {
      setError(toServiceErrorMessage(e, '서비스 이력을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    load(activeStatus, 0).catch(() => {});
  }, [activeStatus, canManageService, canViewService, user?.tenantId]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">완료 이력 관리</h1>
          <p className="mt-1 text-gray-500">완료, 반려, 취소된 서비스 요청 이력을 상태별로 조회합니다. 고객 화면의 상태값과 같은 기준으로 반영됩니다.</p>
        </div>
        <button type="button" onClick={() => load(activeStatus, page)} disabled={!canViewService} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw size={16} />
          새로고침
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((status) => {
          const meta = SERVICE_STATUS_META[status];
          const active = activeStatus === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setActiveStatus(status)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? meta.badge : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {!canManageService && canViewService && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          이력 조회는 가능하지만 서비스 처리 권한이 없어 상태 변경 기능은 사용할 수 없습니다.
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-900">{SERVICE_STATUS_META[activeStatus].label} 이력</h2>
          <span className="text-xs font-semibold text-gray-500">총 {totalElements}개</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-gray-500">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-sm text-gray-500">해당 상태의 이력이 없습니다.</div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {items.map((item) => (
                <li key={item.serviceRequestId} className={`px-5 py-4 ${selectedPassportId && item.passportId === selectedPassportId ? 'bg-green-50/60' : ''}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setDetailPassportId(item.passportId)}
                        className="text-left text-sm font-semibold text-gray-900 underline-offset-4 hover:text-green-700 hover:underline"
                      >
                        {item.modelName || '-'}
                      </button>
                      <div className="mt-1 text-xs text-gray-500">Serial: {item.serialNumber || '-'} | Passport: {item.passportId}</div>
                      <div className="mt-1 text-xs text-gray-400">서비스 요청 ID: {item.serviceRequestId}</div>
                      <div className="mt-1 text-xs text-gray-400">요청 방식: {SERVICE_REQUEST_METHOD_META.labelOf(item.serviceRequestMethod)}</div>
                      <div className="mt-1 text-xs text-gray-400">서비스 유형: {SERVICE_TYPE_META.labelOf(item.serviceType)}</div>
                      <div className="mt-1 text-xs text-gray-400">서비스 업체: {item.providerTenantName || '-'} ({item.providerTenantId || '-'})</div>
                      <div className="mt-1 text-xs text-gray-400">접수 시각: {formatDateTime(item.submittedAt)}</div>
                      {item.serviceResultDetail && (
                        <div className="mt-2 text-xs text-gray-600">완료 내용: {item.serviceResultDetail}</div>
                      )}
                      {item.completionMemo && (
                        <div className="mt-1 text-xs text-gray-600">추가 메모: {item.completionMemo}</div>
                      )}
                      {item.rejectReason && (
                        <div className="mt-2 text-xs text-rose-600">반려 사유: {item.rejectReason}</div>
                      )}
                      {item.cancelReason && (
                        <div className="mt-2 text-xs text-slate-600">취소 사유: {item.cancelReason}</div>
                      )}
                      {Array.isArray(item.afterEvidenceFiles) && item.afterEvidenceFiles.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          완료 첨부:
                          {' '}
                          {item.afterEvidenceFiles.map((file) => (
                            <a
                              key={file.evidenceId}
                              href={file.downloadUrl || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-blue-600 underline"
                            >
                              {file.originalFileName}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={`self-start rounded-full border px-3 py-1 text-xs font-semibold ${SERVICE_STATUS_META[activeStatus].badge}`}>{SERVICE_STATUS_META[activeStatus].label}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-5 py-4">
              <span className="text-xs text-gray-500">페이지 {page + 1} / {totalPages}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => load(activeStatus, Math.max(0, page - 1))} disabled={page === 0} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">이전</button>
                <button type="button" onClick={() => load(activeStatus, Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">다음</button>
              </div>
            </div>
          </>
        )}
      </section>
      <ServicePassportDetailModal
        passportId={detailPassportId}
        isOpen={!!detailPassportId}
        onClose={() => setDetailPassportId('')}
      />
    </div>
  );
};

export default ServiceHistoryPage;
