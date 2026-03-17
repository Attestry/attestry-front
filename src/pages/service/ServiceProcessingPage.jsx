import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Paperclip, RefreshCw, UploadCloud } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRScannerModal from '../../components/shipment/QRScannerModal';
import useAuthStore from '../../store/useAuthStore';
import { COMPLETION_SERVICE_TYPE_OPTIONS, getDefaultServiceResult } from './serviceOptions';
import ServicePassportDetailModal from './ServicePassportDetailModal';
import {
  completeProviderRequest,
  completeProviderServiceEvidence,
  fetchAllProviderRequests,
  hasServiceViewPermission,
  presignProviderServiceEvidence,
  SERVICE_PERMISSION_GUIDE,
  SERVICE_VIEW_PERMISSION_GUIDE,
  SERVICE_STATUS_META,
  fetchProviderRequests,
  formatDateTime,
  SERVICE_REQUEST_METHOD_META,
  SERVICE_TYPE_META,
  hasServiceManagePermission,
  toServiceErrorMessage,
} from './serviceApi';
import { formatBytes, uploadEvidenceFiles } from './serviceEvidenceUpload';
import { extractPassportIdFromQr } from './serviceQr';

const PAGE_SIZE = 20;
const SERVICE_COMPLETE_TEXT_MAX_LENGTH = 2000;
const trimToMaxLength = (value, maxLength) => String(value || '').slice(0, maxLength);

const ServiceProcessingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [editingId, setEditingId] = useState('');
  const [completeForms, setCompleteForms] = useState({});
  const [uploadingId, setUploadingId] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMatches, setScanMatches] = useState([]);
  const [scannedPassportId, setScannedPassportId] = useState(location.state?.selectedPassportId || '');
  const [detailPassportId, setDetailPassportId] = useState('');
  const fileInputRefs = useRef({});
  const notice = location.state?.notice || '';
  const buildDefaultCompleteForm = () => {
    const defaultServiceType = COMPLETION_SERVICE_TYPE_OPTIONS[0]?.value || 'REPAIR';
    return {
      serviceType: defaultServiceType,
      serviceResult: getDefaultServiceResult(defaultServiceType),
      completionMemo: '',
      afterEvidenceGroupId: '',
      uploadedFiles: [],
      selectedFiles: [],
    };
  };

  const load = useCallback(async (pageNum = page) => {
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
      const data = await fetchProviderRequests(user.tenantId, 'ACCEPTED', pageNum, PAGE_SIZE);
      setItems(Array.isArray(data?.content) ? data.content : []);
      setTotalPages(Math.max(1, data?.totalPages || 1));
      setTotalElements(data?.totalElements || 0);
      setPage(pageNum);
    } catch (e) {
      setError(toServiceErrorMessage(e, '진행 중 서비스 요청을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [canViewService, page, user?.tenantId]);

  useEffect(() => {
    load(0).catch(() => {});
  }, [load]);

  useEffect(() => {
    const selectedPassportId = location.state?.selectedPassportId;
    if (!selectedPassportId || !user?.tenantId || !canViewService) return;

    const focusSelectedPassport = async () => {
      try {
        const allItems = await fetchAllProviderRequests(user.tenantId, 'ACCEPTED');
        const matches = allItems.filter((item) => item.passportId === selectedPassportId);
        if (matches.length === 1) {
          setEditingId(matches[0].serviceRequestId);
          updateForm(matches[0].serviceRequestId, {});
          setScanMatches([]);
        } else if (matches.length > 1) {
          setScanMatches(matches);
        }
      } catch (e) {
        setError(toServiceErrorMessage(e, '선택된 제품의 진행 중 요청을 찾지 못했습니다.'));
      }
    };

    focusSelectedPassport().catch(() => {});
  }, [canViewService, location.state?.selectedPassportId, updateForm, user?.tenantId]);

  const handleComplete = async (item) => {
    const form = completeForms[item.serviceRequestId] || buildDefaultCompleteForm();
    if (editingId !== item.serviceRequestId) {
      updateForm(item.serviceRequestId, {});
      setEditingId(item.serviceRequestId);
      return;
    }
    if (!form.afterEvidenceGroupId) {
      setError('완료 첨부파일을 먼저 업로드해주세요.');
      return;
    }
    if (!String(form.serviceResult || '').trim()) {
      setError('완료 내용을 입력해주세요.');
      return;
    }
    if (!String(form.completionMemo || '').trim()) {
      setError('추가 메모를 입력해주세요.');
      return;
    }
    const actionKey = `complete-${item.serviceRequestId}`;
    setActionLoading(actionKey);
    setError('');
    try {
      await completeProviderRequest(user.tenantId, item.serviceRequestId, {
        serviceType: form.serviceType,
        afterEvidenceGroupId: form.afterEvidenceGroupId || null,
        serviceResult: form.serviceResult || getDefaultServiceResult(form.serviceType),
        completionMemo: form.completionMemo || null,
      });
      setEditingId('');
      navigate('/service/history', {
        state: {
          activeStatus: 'COMPLETED',
          notice: `${item.modelName || item.passportId} 요청이 완료 처리되었습니다.`,
          selectedPassportId: item.passportId,
        },
      });
    } catch (e) {
      setError(toServiceErrorMessage(e, '서비스 완료 처리에 실패했습니다.'));
    } finally {
      setActionLoading('');
    }
  };

  const updateForm = useCallback((serviceRequestId, patch) => {
    setCompleteForms((prev) => ({
      ...prev,
      [serviceRequestId]: {
        ...buildDefaultCompleteForm(),
        ...(prev[serviceRequestId] || {}),
        ...patch,
      },
    }));
  }, []);

  const handleServiceTypeChange = (serviceRequestId, nextServiceType) => {
    updateForm(serviceRequestId, {
      serviceType: nextServiceType,
      serviceResult: getDefaultServiceResult(nextServiceType),
    });
  };

  const handleLimitedPaste = (event, currentValue, maxLength, updater) => {
    event.preventDefault();
    const clipboardText = event.clipboardData?.getData('text') || '';
    if (!clipboardText) {
      return;
    }
    const target = event.currentTarget;
    const selectionStart = target.selectionStart ?? currentValue.length;
    const selectionEnd = target.selectionEnd ?? selectionStart;
    const nextValue = `${currentValue.slice(0, selectionStart)}${clipboardText}${currentValue.slice(selectionEnd)}`;
    updater(trimToMaxLength(nextValue, maxLength));
  };

  const handleSelectFiles = (serviceRequestId, files) => {
    const selectedFiles = Array.from(files || []);
    updateForm(serviceRequestId, { selectedFiles });
    if (selectedFiles.length === 0) {
      return;
    }

    const item = items.find((entry) => entry.serviceRequestId === serviceRequestId);
    if (!item) {
      setError('선택한 요청 정보를 찾지 못했습니다.');
      return;
    }

    handleUploadEvidence(item, selectedFiles).catch(() => {});
  };

  const handleUploadEvidence = async (item, selectedFilesOverride = null) => {
    const form = completeForms[item.serviceRequestId] || {};
    const selectedFiles = selectedFilesOverride || form.selectedFiles || [];
    if (selectedFiles.length === 0) {
      setError('업로드할 완료 첨부파일을 선택해주세요.');
      return;
    }

    setUploadingId(item.serviceRequestId);
    setError('');
    try {
      const result = await uploadEvidenceFiles({
        files: selectedFiles,
        initialEvidenceGroupId: form.afterEvidenceGroupId || null,
        presign: (payload) => presignProviderServiceEvidence(user.tenantId, payload),
        complete: (payload) => completeProviderServiceEvidence(user.tenantId, payload),
        onProgress: (progress) => updateForm(item.serviceRequestId, { uploadProgress: progress }),
      });
      updateForm(item.serviceRequestId, {
        afterEvidenceGroupId: result.evidenceGroupId || '',
        uploadedFiles: [...(form.uploadedFiles || []), ...result.uploadedFiles],
        selectedFiles: [],
        uploadProgress: { total: 0, done: 0, current: '' },
      });
      if (fileInputRefs.current[item.serviceRequestId]) {
        fileInputRefs.current[item.serviceRequestId].value = '';
      }
    } catch (e) {
      setError(toServiceErrorMessage(e, '완료 첨부 업로드에 실패했습니다.'));
    } finally {
      setUploadingId('');
    }
  };

  const focusItem = (item) => {
    setEditingId(item.serviceRequestId);
    updateForm(item.serviceRequestId, {});
    setScanMatches([]);
    setScannedPassportId(item.passportId || '');
    setError('');
  };

  const handleQrScanSuccess = async (decodedText) => {
    const passportId = extractPassportIdFromQr(decodedText);
    setScannerOpen(false);
    setScannedPassportId(passportId);
    setError('');

    try {
      const allItems = await fetchAllProviderRequests(user.tenantId, 'ACCEPTED');
      const matches = allItems.filter((item) => item.passportId === passportId);

      if (matches.length === 0) {
        setError('전체 진행 중 요청 목록에서 스캔한 제품과 일치하는 요청을 찾지 못했습니다.');
        return;
      }
      if (matches.length === 1) {
        focusItem(matches[0]);
        return;
      }
      setScanMatches(matches);
    } catch (e) {
      setError(toServiceErrorMessage(e, 'QR로 진행 중 요청을 찾지 못했습니다.'));
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">수신 요청 처리</h1>
          <p className="mt-1 text-sm leading-6 text-gray-500 sm:text-base">서비스 처리가 완료되면 작업 내용과 제품 사진을 정리해 신뢰도 높은 완료 이력으로 남겨주세요.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {canManageService && (
            <button type="button" onClick={() => setScannerOpen(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 sm:w-auto">
              QR 스캔
            </button>
          )}
          <button type="button" onClick={() => load(page)} disabled={!canViewService} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </header>

      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
      {!canManageService && canViewService && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          목록 조회만 가능합니다. 완료 처리는 서비스 처리 권한이 있는 멤버만 수행할 수 있습니다.
        </div>
      )}
      {scannedPassportId && !error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          스캔된 제품 Passport: {scannedPassportId}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-gray-900">진행 중 요청</h2>
          <span className="text-xs font-semibold text-gray-500">총 {totalElements}개</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-gray-500">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-sm text-gray-500">진행 중인 서비스 요청이 없습니다.</div>
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
                        className="text-left text-sm font-semibold text-gray-900 underline-offset-4 hover:text-green-700 hover:underline"
                      >
                        {item.modelName || '-'}
                      </button>
                      <div className="mt-1 break-all text-xs text-gray-500">Serial: {item.serialNumber || '-'} | Passport: {item.passportId}</div>
                      <div className="mt-1 break-all text-xs text-gray-400">서비스 요청 ID: {item.serviceRequestId}</div>
                      <div className="mt-1 text-xs text-gray-400">요청 방식: {SERVICE_REQUEST_METHOD_META.labelOf(item.serviceRequestMethod)}</div>
                      <div className="mt-1 text-xs text-gray-400">서비스 유형: {SERVICE_TYPE_META.labelOf(item.serviceType)}</div>
                      <div className="mt-1 text-xs text-gray-400">설명: {item.description || '-'}</div>
                      <div className="mt-1 text-xs text-gray-400">접수 시각: {formatDateTime(item.submittedAt)}</div>
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
                          <div className="mt-2 flex flex-col gap-1">
                            {item.beforeEvidenceFiles.map((file) => (
                              <a
                                key={file.evidenceId}
                                href={file.downloadUrl || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-blue-600 underline"
                              >
                                {file.originalFileName}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {editingId === item.serviceRequestId && (
                        <div className="mt-3 space-y-3 rounded-xl border border-green-100 bg-green-50/70 p-3">
                          <label className="block text-xs font-medium text-gray-700">
                            서비스 유형
                            <select
                              value={completeForms[item.serviceRequestId]?.serviceType || COMPLETION_SERVICE_TYPE_OPTIONS[0]?.value || 'REPAIR'}
                              onChange={(e) => handleServiceTypeChange(item.serviceRequestId, e.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                            >
                              {COMPLETION_SERVICE_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-xs font-medium text-gray-700">
                            완료 내용
                            <input
                              type="text"
                              value={completeForms[item.serviceRequestId]?.serviceResult || getDefaultServiceResult(completeForms[item.serviceRequestId]?.serviceType)}
                              onChange={(e) => updateForm(item.serviceRequestId, { serviceResult: trimToMaxLength(e.target.value, SERVICE_COMPLETE_TEXT_MAX_LENGTH) })}
                              onPaste={(e) => handleLimitedPaste(
                                e,
                                completeForms[item.serviceRequestId]?.serviceResult || getDefaultServiceResult(completeForms[item.serviceRequestId]?.serviceType),
                                SERVICE_COMPLETE_TEXT_MAX_LENGTH,
                                (nextValue) => updateForm(item.serviceRequestId, { serviceResult: nextValue })
                              )}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              placeholder="서비스 유형을 선택하면 기본 완료 문구가 자동 입력됩니다."
                              maxLength={SERVICE_COMPLETE_TEXT_MAX_LENGTH}
                            />
                            <div className="mt-1 flex justify-end text-[11px] text-gray-500">
                              {(completeForms[item.serviceRequestId]?.serviceResult || getDefaultServiceResult(completeForms[item.serviceRequestId]?.serviceType)).length}/{SERVICE_COMPLETE_TEXT_MAX_LENGTH}
                            </div>
                          </label>
                          <label className="block text-xs font-medium text-gray-700">
                            추가 메모
                            <textarea
                              rows={3}
                              value={completeForms[item.serviceRequestId]?.completionMemo || ''}
                              onChange={(e) => updateForm(item.serviceRequestId, { completionMemo: trimToMaxLength(e.target.value, SERVICE_COMPLETE_TEXT_MAX_LENGTH) })}
                              onPaste={(e) => handleLimitedPaste(
                                e,
                                completeForms[item.serviceRequestId]?.completionMemo || '',
                                SERVICE_COMPLETE_TEXT_MAX_LENGTH,
                                (nextValue) => updateForm(item.serviceRequestId, { completionMemo: nextValue })
                              )}
                              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              placeholder="예: 차주 정기 점검 권장"
                              maxLength={SERVICE_COMPLETE_TEXT_MAX_LENGTH}
                            />
                            <div className="mt-1 flex justify-end text-[11px] text-gray-500">
                              {(completeForms[item.serviceRequestId]?.completionMemo || '').length}/{SERVICE_COMPLETE_TEXT_MAX_LENGTH}
                            </div>
                          </label>
                          <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                              <Paperclip size={14} className="text-green-600" />
                              완료 첨부
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                              파일을 선택하면 바로 업로드됩니다. 업로드가 끝나면 아래 완료 내용과 메모를 확인한 뒤 `확인`으로 마무리합니다.
                            </p>
                            <input
                              ref={(element) => {
                                fileInputRefs.current[item.serviceRequestId] = element;
                              }}
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => handleSelectFiles(item.serviceRequestId, e.target.files)}
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[item.serviceRequestId]?.click()}
                              disabled={uploadingId === item.serviceRequestId}
                              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <UploadCloud size={15} />
                              {uploadingId === item.serviceRequestId ? '업로드 중...' : '파일 선택'}
                            </button>
                            {(completeForms[item.serviceRequestId]?.selectedFiles || []).length > 0 && (
                              <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                <div className="mb-1 font-semibold text-gray-700">선택한 파일</div>
                                {(completeForms[item.serviceRequestId]?.selectedFiles || []).map((file) => (
                                  <div key={`${file.name}-${file.size}`}>{file.name} ({formatBytes(file.size)})</div>
                                ))}
                              </div>
                            )}
                            {(completeForms[item.serviceRequestId]?.uploadedFiles || []).length > 0 && (
                              <div className="mt-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-gray-600">
                                <div className="mb-1 font-semibold text-green-700">업로드 완료</div>
                                {(completeForms[item.serviceRequestId]?.uploadedFiles || []).map((file) => (
                                  <div key={file.evidenceId}>{file.fileName} ({formatBytes(file.sizeBytes)})</div>
                                ))}
                              </div>
                            )}
                            {completeForms[item.serviceRequestId]?.uploadProgress?.total > 0 && (
                              <div className="mt-2 text-xs text-blue-700">
                                업로드 진행: {completeForms[item.serviceRequestId]?.uploadProgress?.done || 0}/
                                {completeForms[item.serviceRequestId]?.uploadProgress?.total || 0}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${SERVICE_STATUS_META.ACCEPTED.badge}`}>{SERVICE_STATUS_META.ACCEPTED.label}</span>
                      {canManageService && (
                        <button type="button" onClick={() => handleComplete(item)} disabled={!!actionLoading} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
                          <CheckCircle2 size={16} />
                          확인
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
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
              <p className="mt-1 text-sm text-gray-500">같은 제품에 대한 진행 중 요청이 여러 건 있습니다. 완료 처리할 요청을 선택하세요.</p>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-4">
              {scanMatches.map((item) => (
                <button
                  key={item.serviceRequestId}
                  type="button"
                  onClick={() => focusItem(item)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-green-200 hover:bg-green-50"
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
        accent="service"
      />
      <ServicePassportDetailModal
        passportId={detailPassportId}
        isOpen={!!detailPassportId}
        onClose={() => setDetailPassportId('')}
      />
    </div>
  );
};

export default ServiceProcessingPage;
