import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Wrench, XCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cancelMyServiceRequest, listMyServiceRequests } from './consumerServiceApi';
import { formatDateTime } from './serviceApi';
import { getServiceRequestMethodLabel, getServiceTypeLabel } from './serviceOptions';

const STATUS_META = {
  PENDING: { label: '요청 전송', badge: 'bg-amber-50 text-amber-700 border-amber-100' },
  ACCEPTED: { label: '서비스 접수', badge: 'bg-blue-50 text-blue-700 border-blue-100' },
  COMPLETED: { label: '서비스 완료', badge: 'bg-green-50 text-green-700 border-green-100' },
  REJECTED: { label: '반려', badge: 'bg-rose-50 text-rose-700 border-rose-100' },
  CANCELLED: { label: '취소', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const TABS = ['PENDING', 'ACCEPTED', 'COMPLETED', 'REJECTED', 'CANCELLED'];

const MyServiceRequestsUserPage = () => {
  const location = useLocation();
  const notice = location.state?.notice || '';
  const createdRequestId = location.state?.createdRequestId || '';
  const [activeStatus, setActiveStatus] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [actionLoading, setActionLoading] = useState('');

  const highlightedId = useMemo(() => createdRequestId, [createdRequestId]);

  const load = async (status = activeStatus, pageNum = page) => {
    setLoading(true);
    setError('');
    try {
      const data = await listMyServiceRequests(status, pageNum, 20);
      setItems(Array.isArray(data?.content) ? data.content : []);
      setTotalPages(Math.max(1, data?.totalPages || 1));
      setTotalElements(data?.totalElements || 0);
      setPage(pageNum);
    } catch (e) {
      setItems([]);
      setError(e?.message || '내 서비스 요청을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeStatus, 0).catch(() => {});
  }, [activeStatus]);

  const handleCancel = async (item) => {
    const cancelReason = window.prompt('취소 사유를 입력하세요.', '');
    if (cancelReason === null) return;

    const actionKey = `cancel-${item.serviceRequestId}`;
    setActionLoading(actionKey);
    setError('');
    try {
      await cancelMyServiceRequest(item.serviceRequestId, cancelReason);
      await load(activeStatus, page);
    } catch (e) {
      setError(e?.message || '서비스 요청 취소에 실패했습니다.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Wrench size={14} />
            내 서비스 요청
          </div>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">서비스 요청 현황</h1>
          <p className="mt-2 text-sm text-gray-500">
            서비스 업체로 보낸 요청의 현재 상태를 확인합니다. 업체가 수락하면 `서비스 접수`, 완료하면 `서비스 완료`로 표시됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(activeStatus, page)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </header>

      {notice && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((status) => {
          const meta = STATUS_META[status];
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

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-900">{STATUS_META[activeStatus].label} 목록</h2>
          <span className="text-xs font-semibold text-gray-500">총 {totalElements}개</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-gray-500">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-sm text-gray-500">해당 상태의 서비스 요청이 없습니다.</div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {items.map((item) => {
                const meta = STATUS_META[item.status] || STATUS_META.PENDING;
                const isHighlighted = highlightedId && highlightedId === item.serviceRequestId;
                return (
                  <li
                    key={item.serviceRequestId}
                    className={`px-5 py-4 ${isHighlighted ? 'bg-amber-50/60' : ''}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">{item.modelName || '-'}</div>
                        <div className="mt-1 text-xs text-gray-500">Serial: {item.serialNumber || '-'} | Passport: {item.passportId}</div>
                        <div className="mt-1 text-xs text-gray-400">서비스 업체: {item.providerTenantName || '-'} ({item.providerTenantId || '-'})</div>
                        <div className="mt-1 text-xs text-gray-400">요청 방식: {getServiceRequestMethodLabel(item.serviceRequestMethod)}</div>
                        <div className="mt-1 text-xs text-gray-400">서비스 유형: {getServiceTypeLabel(item.serviceType)}</div>
                        <div className="mt-1 text-xs text-gray-400">요청 시각: {formatDateTime(item.submittedAt)}</div>
                        {item.symptomDescription && (
                          <div className="mt-2 text-xs text-gray-600">증상 설명: {item.symptomDescription}</div>
                        )}
                        {item.requestedReservationAt && (
                          <div className="mt-1 text-xs text-gray-600">희망 예약일: {formatDateTime(item.requestedReservationAt)}</div>
                        )}
                        {item.contactMemo && (
                          <div className="mt-1 text-xs text-gray-600">연락 메모: {item.contactMemo}</div>
                        )}
                        {Array.isArray(item.beforeEvidenceFiles) && item.beforeEvidenceFiles.length > 0 && (
                          <div className="mt-2 text-xs text-gray-600">
                            신청 첨부:
                            {' '}
                            {item.beforeEvidenceFiles.map((file) => (
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
                        {item.serviceResultDetail && (
                          <div className="mt-2 text-xs text-gray-600">처리 결과: {item.serviceResultDetail}</div>
                        )}
                        {item.completionMemo && (
                          <div className="mt-1 text-xs text-gray-600">완료 메모: {item.completionMemo}</div>
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
                      <div className="flex items-center gap-2">
                        {item.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleCancel(item)}
                            disabled={!!actionLoading}
                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <XCircle size={14} />
                            취소
                          </button>
                        )}
                        {isHighlighted && (
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-amber-700">
                            방금 요청됨
                          </span>
                        )}
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-5 py-4">
              <span className="text-xs text-gray-500">페이지 {page + 1} / {totalPages}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => load(activeStatus, Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => load(activeStatus, Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
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

export default MyServiceRequestsUserPage;
