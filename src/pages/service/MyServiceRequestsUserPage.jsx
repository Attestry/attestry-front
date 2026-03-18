import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Sparkles, Wrench, XCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cancelMyServiceRequest, listMyServiceRequests } from './consumerServiceApi';
import { formatDateTime } from './serviceApi';
import { getServiceRequestMethodLabel, getServiceTypeLabel } from './serviceOptions';
import ReasonModal from './ReasonModal';

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
  const isStandalonePage = location.pathname === '/service-request/my';
  const [activeStatus, setActiveStatus] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [actionLoading, setActionLoading] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);

  const highlightedId = useMemo(() => createdRequestId, [createdRequestId]);

  const load = useCallback(async (status = activeStatus, pageNum = page) => {
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
  }, [activeStatus, page]);

  useEffect(() => {
    load(activeStatus, 0).catch(() => {});
  }, [activeStatus, load]);

  const confirmCancel = async (cancelReason) => {
    if (!cancelTarget) return;
    const actionKey = `cancel-${cancelTarget.serviceRequestId}`;
    setActionLoading(actionKey);
    setError('');
    try {
      await cancelMyServiceRequest(cancelTarget.serviceRequestId, cancelReason);
      setCancelTarget(null);
      await load(activeStatus, page);
    } catch (e) {
      setError(e?.message || '서비스 요청 취소에 실패했습니다.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className={isStandalonePage ? 'tracera-page-shell min-h-[calc(100vh-4rem)]' : ''}>
      <div className={isStandalonePage ? 'mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10' : 'space-y-6'}>
        <header className={isStandalonePage ? 'tracera-page-hero' : 'tracera-page-card px-5 py-6 sm:px-6'}>
          <div className="relative z-10 tracera-page-toolbar">
            <div className="min-w-0">
              <div className={isStandalonePage ? 'tracera-page-tag' : 'tracera-page-pill'}>
                <Wrench size={14} />
                MY SERVICE REQUESTS
              </div>
              <h1 className="tracera-keepall mt-4 text-3xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-[2.45rem]">
                신청한 서비스 이력
              </h1>
              <p className="tracera-keepall mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[0.96rem]">
                서비스 업체로 보낸 요청의 현재 상태와 첨부 이력을 한 화면에서 확인합니다. 접수, 완료, 반려, 취소 흐름이 같은 기준으로 정리됩니다.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <button
                type="button"
                onClick={() => load(activeStatus, page)}
                className="tracera-page-cta whitespace-nowrap"
              >
                <RefreshCw size={16} />
                새로고침
              </button>
              {totalElements > 0 && (
                <div className="tracera-page-pill">
                  <Sparkles size={13} />
                  총 {totalElements}건
                </div>
              )}
            </div>
          </div>
        </header>

        {notice && (
          <div className="tracera-page-card-soft border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {error && (
          <div className="tracera-page-card-soft border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

          <div className="tracera-page-card px-4 py-4 sm:px-5">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            {TABS.map((status) => {
              const meta = STATUS_META[status];
              const active = activeStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setActiveStatus(status)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition sm:w-auto ${active ? `${meta.badge} shadow-sm` : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <section className="tracera-page-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">{STATUS_META[activeStatus].label} 목록</h2>
              <p className="mt-1 text-xs text-slate-500">현재 상태 기준으로 서비스 요청된 목록입니다.</p>
            </div>
            <span className="tracera-page-pill w-fit">총 {totalElements}개</span>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-sm text-slate-500">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="px-5 py-12 text-sm text-slate-500">해당 상태의 서비스 요청이 없습니다.</div>
          ) : (
            <>
              <ul className="grid gap-4 p-4 sm:p-5">
                {items.map((item) => {
                  const meta = STATUS_META[item.status] || STATUS_META.PENDING;
                  const isHighlighted = highlightedId && highlightedId === item.serviceRequestId;
                  return (
                    <li
                      key={item.serviceRequestId}
                      className={`tracera-page-card-soft p-4 sm:p-5 ${isHighlighted ? 'border-amber-200 bg-amber-50/60' : ''}`}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-slate-900">{item.modelName || '-'}</div>
                            {isHighlighted && (
                              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-amber-700 shadow-sm">
                                방금 요청됨
                              </span>
                            )}
                          </div>
                          <div className="mt-2 break-all text-xs text-slate-500">Serial: {item.serialNumber || '-'} | Passport: {item.passportId}</div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <InfoRow label="서비스 업체" value={`${item.providerTenantName || '-'} (${item.providerTenantId || '-'})`} />
                            <InfoRow label="요청 방식" value={getServiceRequestMethodLabel(item.serviceRequestMethod)} />
                            <InfoRow label="서비스 유형" value={getServiceTypeLabel(item.serviceType)} />
                            <InfoRow label="요청 시각" value={formatDateTime(item.submittedAt)} />
                            {item.requestedReservationAt && <InfoRow label="희망 예약일" value={formatDateTime(item.requestedReservationAt)} />}
                            {item.contactMemo && <InfoRow label="연락 메모" value={item.contactMemo} />}
                          </div>

                          {item.symptomDescription && (
                            <DetailBlock label="증상 설명" value={item.symptomDescription} />
                          )}
                          {item.serviceResultDetail && (
                            <DetailBlock label="처리 결과" value={item.serviceResultDetail} />
                          )}
                          {item.completionMemo && (
                            <DetailBlock label="완료 메모" value={item.completionMemo} />
                          )}
                          {item.rejectReason && (
                            <DetailBlock label="반려 사유" value={item.rejectReason} tone="danger" />
                          )}
                          {item.cancelReason && (
                            <DetailBlock label="취소 사유" value={item.cancelReason} />
                          )}
                          {Array.isArray(item.beforeEvidenceFiles) && item.beforeEvidenceFiles.length > 0 && (
                            <AttachmentRow label="신청 첨부" files={item.beforeEvidenceFiles} />
                          )}
                          {Array.isArray(item.afterEvidenceFiles) && item.afterEvidenceFiles.length > 0 && (
                            <AttachmentRow label="완료 첨부" files={item.afterEvidenceFiles} />
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                          <span className={`inline-flex min-h-[32px] items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.badge}`}>
                            {meta.label}
                          </span>
                              {item.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(item)}
                              disabled={!!actionLoading}
                              className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <XCircle size={14} />
                              취소
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-slate-500">페이지 {page + 1} / {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => load(activeStatus, Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="tracera-button-secondary rounded-xl px-3 py-2 text-sm shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => load(activeStatus, Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="tracera-button-secondary rounded-xl px-3 py-2 text-sm shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
        <ReasonModal
          key={cancelTarget?.serviceRequestId || 'cancel-closed'}
          isOpen={!!cancelTarget}
          title="서비스 요청 취소"
          description="서비스 업체에 전달할 취소 사유를 남겨주세요. 입력한 내용은 요청 이력에 함께 표시됩니다."
          confirmLabel="취소 요청 확정"
          placeholder="예: 일정이 변경되어 서비스 요청을 취소합니다."
          initialValue=""
          tone="danger"
          loading={!!actionLoading}
          onClose={() => {
            if (!actionLoading) setCancelTarget(null);
          }}
          onConfirm={confirmCancel}
        />
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 shadow-[0_12px_32px_-30px_rgba(15,23,42,0.22)]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
    <div className="mt-1 break-words text-sm font-medium text-slate-700">{value}</div>
  </div>
);

const DetailBlock = ({ label, value, tone = 'default' }) => (
  <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${tone === 'danger' ? 'border-rose-200 bg-rose-50/80 text-rose-700' : 'border-slate-200 bg-slate-50/80 text-slate-600'}`}>
    <span className="font-semibold">{label}:</span> {value}
  </div>
);

const AttachmentRow = ({ label, files }) => (
  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
    <div className="mt-2 flex flex-col gap-2">
      {files.map((file) => (
        <a
          key={file.evidenceId}
          href={file.downloadUrl || '#'}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
        >
          <span className="break-all">{file.originalFileName}</span>
        </a>
      ))}
    </div>
  </div>
);

export default MyServiceRequestsUserPage;
