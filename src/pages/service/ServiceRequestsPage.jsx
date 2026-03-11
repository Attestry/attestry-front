import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import QRScannerModal from '../../components/shipment/QRScannerModal';
import useAuthStore from '../../store/useAuthStore';
import ServicePassportDetailModal from './ServicePassportDetailModal';
import {
  acceptProviderRequest,
  fetchAllProviderRequests,
  hasServiceViewPermission,
  rejectProviderRequest,
  SERVICE_PERMISSION_GUIDE,
  SERVICE_REQUEST_METHOD_META,
  SERVICE_VIEW_PERMISSION_GUIDE,
  SERVICE_STATUS_META,
  fetchProviderRequests,
  formatDateTime,
  hasServiceManagePermission,
  toServiceErrorMessage,
} from './serviceApi';
import { extractPassportIdFromQr } from './serviceQr';

const PAGE_SIZE = 20;

const ServiceRequestsPage = () => {
  const navigate = useNavigate();
  const { user, myMemberships } = useAuthStore();
  const canViewService = hasServiceViewPermission(myMemberships, user?.tenantId);
  const canManageService = hasServiceManagePermission(myMemberships, user?.tenantId);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [actionLoading, setActionLoading] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMatches, setScanMatches] = useState([]);
  const [scannedPassportId, setScannedPassportId] = useState('');
  const [detailPassportId, setDetailPassportId] = useState('');

  const load = async (pageNum = page) => {
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
      const data = await fetchProviderRequests(user.tenantId, 'PENDING', pageNum, PAGE_SIZE);
      setItems(Array.isArray(data?.content) ? data.content : []);
      setTotalPages(Math.max(1, data?.totalPages || 1));
      setTotalElements(data?.totalElements || 0);
      setPage(pageNum);
    } catch (e) {
      setError(toServiceErrorMessage(e, '서비스 요청 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0).catch(() => {});
  }, [canManageService, canViewService, user?.tenantId]);

  const acceptAndMove = async (item) => {
    const actionKey = `accept-${item.serviceRequestId}`;
    setActionLoading(actionKey);
    setError('');
    try {
      await acceptProviderRequest(user.tenantId, item.serviceRequestId, {
        description: null,
      });
      setScanMatches([]);
      navigate('/service/processing', {
        state: {
          notice: `${item.modelName || item.passportId} 요청이 접수되었습니다. 완료 처리 단계로 이동합니다.`,
        },
      });
    } catch (e) {
      setError(toServiceErrorMessage(e, '서비스 요청 수락에 실패했습니다.'));
    } finally {
      setActionLoading('');
    }
  };

  const handleAccept = async (item) => {
    await acceptAndMove(item);
  };

  const handleReject = async (item) => {
    const reason = window.prompt('반려 사유를 입력하세요.', '');
    if (reason === null) return;
    const actionKey = `reject-${item.serviceRequestId}`;
    setActionLoading(actionKey);
    setError('');
    try {
      await rejectProviderRequest(user.tenantId, item.serviceRequestId, { reason });
      await load(page);
    } catch (e) {
      setError(toServiceErrorMessage(e, '서비스 요청 반려에 실패했습니다.'));
    } finally {
      setActionLoading('');
    }
  };

  const handleQrScanSuccess = async (decodedText) => {
    const passportId = extractPassportIdFromQr(decodedText);
    setScannerOpen(false);
    setScannedPassportId(passportId);
    setError('');

    try {
      const allItems = await fetchAllProviderRequests(user.tenantId, 'PENDING');
      const matches = allItems.filter((item) => item.passportId === passportId);

      if (matches.length === 0) {
        setError('전체 대기 요청 목록에서 스캔한 제품과 일치하는 요청을 찾지 못했습니다.');
        return;
      }
      if (matches.length === 1) {
        await acceptAndMove(matches[0]);
        return;
      }
      setScanMatches(matches);
    } catch (e) {
      setError(toServiceErrorMessage(e, 'QR로 서비스 요청을 찾지 못했습니다.'));
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">서비스 요청 관리</h1>
          <p className="mt-1 text-gray-500">현재 tenant로 들어온 `PENDING` 서비스 요청을 수락하거나 반려합니다. 수락되면 고객 화면에서는 `서비스 접수`로 반영됩니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageService && (
            <button type="button" onClick={() => setScannerOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
              QR 스캔
            </button>
          )}
          <button type="button" onClick={() => load(page)} disabled={!canViewService} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
      {!canManageService && canViewService && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          목록 조회만 가능합니다. 수락과 반려는 서비스 처리 권한이 있는 멤버만 수행할 수 있습니다.
        </div>
      )}
      {scannedPassportId && !error && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          스캔된 제품 Passport: {scannedPassportId}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-900">대기 중 요청</h2>
          <span className="text-xs font-semibold text-gray-500">총 {totalElements}개</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-gray-500">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-sm text-gray-500">대기 중인 서비스 요청이 없습니다.</div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {items.map((item) => (
                <li key={item.serviceRequestId} className="px-5 py-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setDetailPassportId(item.passportId)}
                        className="text-left text-sm font-semibold text-gray-900 underline-offset-4 hover:text-blue-700 hover:underline"
                      >
                        {item.modelName || '-'}
                      </button>
                      <div className="mt-1 text-xs text-gray-500">Serial: {item.serialNumber || '-'} | Passport: {item.passportId}</div>
                      <div className="mt-1 text-xs text-gray-400">서비스 요청 ID: {item.serviceRequestId}</div>
                      <div className="mt-1 text-xs text-gray-400">고객이 보낸 신규 요청입니다. 확인하면 바로 접수 처리되고 수신 요청 처리로 이동합니다.</div>
                      <div className="mt-1 text-xs text-gray-400">접수 시각: {formatDateTime(item.submittedAt)}</div>
                      <div className="mt-1 text-xs text-gray-400">요청 방식: {SERVICE_REQUEST_METHOD_META.labelOf(item.serviceRequestMethod)}</div>
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${SERVICE_STATUS_META.PENDING.badge}`}>{SERVICE_STATUS_META.PENDING.label}</span>
                      {canManageService && (
                        <>
                          <button type="button" onClick={() => handleAccept(item)} disabled={!!actionLoading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                            <CheckCircle2 size={16} />
                            확인
                          </button>
                          <button type="button" onClick={() => handleReject(item)} disabled={!!actionLoading} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
                            <XCircle size={16} />
                            반려
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-5 py-4">
              <span className="text-xs text-gray-500">페이지 {page + 1} / {totalPages}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => load(Math.max(0, page - 1))} disabled={page === 0} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">이전</button>
                <button type="button" onClick={() => load(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">다음</button>
              </div>
            </div>
          </>
        )}
      </section>
      {scanMatches.length > 1 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setScanMatches([])} />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">동일 제품 요청 선택</h2>
              <p className="mt-1 text-sm text-gray-500">같은 제품에 대한 대기 요청이 여러 건 있습니다. 접수할 요청을 선택하세요.</p>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-4">
              {scanMatches.map((item) => (
                <button
                  key={item.serviceRequestId}
                  type="button"
                  onClick={() => acceptAndMove(item)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className="text-sm font-semibold text-gray-900">{item.modelName || '-'}</div>
                  <div className="mt-1 text-xs text-gray-500">Serial: {item.serialNumber || '-'} | Request: {item.serviceRequestId}</div>
                  <div className="mt-1 text-xs text-gray-400">접수 시각: {formatDateTime(item.submittedAt)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleQrScanSuccess}
      />
      <ServicePassportDetailModal
        passportId={detailPassportId}
        isOpen={!!detailPassportId}
        onClose={() => setDetailPassportId('')}
      />
    </div>
  );
};

export default ServiceRequestsPage;
