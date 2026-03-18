import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, MapPin, Paperclip, RefreshCw, UploadCloud, Wrench } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import QRScannerModal from '../../components/shipment/QRScannerModal';
import {
  completeOwnerServiceEvidence,
  getServiceProvider,
  listMyPassports,
  presignOwnerServiceEvidence,
  submitServiceRequest,
} from './consumerServiceApi';
import { formatBytes, uploadEvidenceFiles } from './serviceEvidenceUpload';
import { SERVICE_REQUEST_METHOD_OPTIONS, toApiDateTime } from './serviceOptions';
import { extractPassportIdFromQr } from './serviceQr';

const SYMPTOM_DESCRIPTION_MAX_LENGTH = 1000;
const CONTACT_MEMO_MAX_LENGTH = 300;
const getTrimmedText = (value, maxLength) => String(value || '').slice(0, maxLength);

const ServiceProviderDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId } = useParams();
  const [provider, setProvider] = useState(location.state?.provider || null);
  const preselectedPassportId = location.state?.selectedPassport?.passportId || '';
  const [passports, setPassports] = useState([]);
  const [selectedPassportId, setSelectedPassportId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, done: 0, current: '' });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [beforeEvidenceGroupId, setBeforeEvidenceGroupId] = useState('');
  const [serviceRequestMethod, setServiceRequestMethod] = useState('ONLINE');
  const [symptomDescription, setSymptomDescription] = useState('');
  const [requestedReservationAt, setRequestedReservationAt] = useState('');
  const [contactMemo, setContactMemo] = useState('');
  const [error, setError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileInputRef = useRef(null);

  const selectedPassport = useMemo(
    () => passports.find((passport) => passport.passportId === selectedPassportId) || null,
    [passports, selectedPassportId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [providerData, passportData] = await Promise.all([
        provider
          ? Promise.resolve(provider)
          : getServiceProvider(tenantId),
        listMyPassports(),
      ]);

      if (!providerData) {
        setError('서비스 업체 정보를 찾을 수 없습니다.');
      }
      const myPassports = Array.isArray(passportData) ? passportData : [];
      setProvider(providerData);
      setPassports(myPassports);
      setSelectedPassportId((current) => {
        if (current) return current;
        if (preselectedPassportId && myPassports.some((passport) => passport.passportId === preselectedPassportId)) {
          return preselectedPassportId;
        }
        return myPassports[0]?.passportId || '';
      });
    } catch (e) {
      setError(e?.message || '서비스 신청 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [preselectedPassportId, provider, tenantId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPassportId || !provider?.tenantId) return;
    if (!provider?.address) {
      setError('업체 주소가 등록되지 않아 서비스 신청을 진행할 수 없습니다.');
      return;
    }
    if (!symptomDescription.trim()) {
      setError('증상 설명을 입력해주세요.');
      return;
    }
    if (!contactMemo.trim()) {
      setError('연락 메모를 입력해주세요.');
      return;
    }
    if (serviceRequestMethod === 'VISIT' && !requestedReservationAt) {
      setError('직접 방문 요청은 희망 방문 일시를 입력해야 합니다.');
      return;
    }
    if (!beforeEvidenceGroupId && selectedFiles.length === 0) {
      setError('신청 첨부파일을 선택해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSubmitMessage('');
    try {
      let evidenceGroupId = beforeEvidenceGroupId || null;

      if (!evidenceGroupId && selectedFiles.length > 0) {
        const uploadResult = await handleUploadEvidence(selectedFiles);
        evidenceGroupId = uploadResult?.evidenceGroupId || null;
      }

      const response = await submitServiceRequest(selectedPassportId, provider.tenantId, {
        beforeEvidenceGroupId: evidenceGroupId,
        serviceRequestMethod,
        symptomDescription: symptomDescription.trim() || null,
        requestedReservationAt: serviceRequestMethod === 'VISIT' ? toApiDateTime(requestedReservationAt) : null,
        contactMemo: contactMemo.trim() || null,
      });
      navigate('/service-request/my', {
        replace: true,
        state: {
          notice: `${provider.name || '선택한 업체'}에 서비스 요청을 보냈습니다.`,
          createdRequestId: response?.serviceRequestId || '',
        },
      });
    } catch (e) {
      setError(e?.message || '서비스 신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadEvidence = async (selectedFilesOverride = null) => {
    const filesToUpload = selectedFilesOverride || selectedFiles;
    if (filesToUpload.length === 0) {
      throw new Error('업로드할 첨부파일을 선택해주세요.');
    }

    setUploading(true);
    setError('');
    try {
      const result = await uploadEvidenceFiles({
        files: filesToUpload,
        initialEvidenceGroupId: beforeEvidenceGroupId || null,
        presign: presignOwnerServiceEvidence,
        complete: completeOwnerServiceEvidence,
        onProgress: setUploadProgress,
      });
      setBeforeEvidenceGroupId(result.evidenceGroupId || '');
      setUploadedFiles(result.uploadedFiles);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return result;
    } catch (e) {
      throw new Error(e?.message || '첨부파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setUploadProgress({ total: 0, done: 0, current: '' });
    }
  };

  const handleSelectFiles = (files) => {
    const nextFiles = Array.from(files || []);
    setBeforeEvidenceGroupId('');
    setUploadedFiles([]);
    setSelectedFiles((prev) => [...prev, ...nextFiles]);
  };

  const handleRemoveSelectedFile = (indexToRemove) => {
    setBeforeEvidenceGroupId('');
    setUploadedFiles([]);
    setSelectedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleQrScanSuccess = (decodedText) => {
    const passportId = extractPassportIdFromQr(decodedText);
    const matchedPassport = passports.find((passport) => passport.passportId === passportId);

    setScannerOpen(false);
    if (!matchedPassport) {
      setError('스캔한 QR이 현재 내 자산 목록과 일치하지 않습니다. 내 자산의 공개 QR을 다시 확인해주세요.');
      return;
    }

    setSelectedPassportId(matchedPassport.passportId);
    setError('');
    setSubmitMessage(`QR로 ${matchedPassport.modelName || matchedPassport.serialNumber || matchedPassport.passportId} 자산을 선택했습니다.`);
  };

  const handleLimitedPaste = (event, currentValue, maxLength, setter) => {
    event.preventDefault();
    const clipboardText = event.clipboardData?.getData('text') || '';
    if (!clipboardText) {
      return;
    }

    const target = event.currentTarget;
    const selectionStart = target.selectionStart ?? currentValue.length;
    const selectionEnd = target.selectionEnd ?? selectionStart;
    const nextValue = `${currentValue.slice(0, selectionStart)}${clipboardText}${currentValue.slice(selectionEnd)}`;
    setter(getTrimmedText(nextValue, maxLength));
  };

  const symptomDescriptionLength = symptomDescription.length;
  const contactMemoLength = contactMemo.length;

  return (
    <div className="tracera-workflow-page mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6 md:py-10">
      <header className="tracera-workflow-hero">
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
          <button
            type="button"
            onClick={() => navigate('/service-request/providers')}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            서비스 업체 목록으로
          </button>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-[2.5rem]">{provider?.name || '서비스 업체'}</h1>
          <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-200">
            <MapPin size={14} />
            {provider?.region || '지역 정보 없음'}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            자산 선택, 접수 방식, 증상 설명, 첨부파일까지 한 번에 정리해 서비스 신청을 보낼 수 있습니다.
          </p>
          <p className="mt-3 text-xs text-slate-300">Tenant ID: {provider?.tenantId || tenantId}</p>
          </div>
          <button type="button" onClick={() => load()} className="tracera-workflow-button w-full justify-center sm:w-auto">
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {submitMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {submitMessage}
        </div>
      )}

      <section className="tracera-workflow-section">
        <div className="flex items-center gap-2">
          <Wrench size={18} className="text-amber-600" />
          <h2 className="text-lg font-bold text-slate-950">서비스 업체 정보</h2>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-500">업체명</div>
            <div className="mt-2 text-sm font-semibold text-slate-950">{provider?.name || '-'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-500">지역</div>
            <div className="mt-2 text-sm font-semibold text-slate-950">{provider?.region || '-'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
            <div className="text-xs font-semibold text-slate-500">주소</div>
            <div className="mt-2 text-sm font-semibold text-slate-950">{provider?.address || '-'}</div>
          </div>
        </div>
      </section>

      <section className="tracera-workflow-section">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-amber-600" />
          <h2 className="text-lg font-bold text-slate-950">서비스 신청하기</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          제품 선택부터 접수 메모와 첨부자료까지 한 번에 정리해, 서비스 담당자가 바로 이해할 수 있는 요청으로 전환합니다.
        </p>
        {!provider?.address && (
          <p className="mt-2 text-xs text-rose-600">
            업체 주소가 등록되지 않아 현재 신청할 수 없습니다. 서비스 업체 주소 등록이 먼저 필요합니다.
          </p>
        )}
        {preselectedPassportId && (
          <p className="mt-2 text-xs text-amber-700">
            내 디지털 자산 화면에서 선택한 자산이 기본 선택되어 있습니다. 필요하면 다른 자산으로 변경할 수 있습니다.
          </p>
        )}

        {loading ? (
          <div className="mt-6 text-sm text-gray-500">신청 가능한 자산 목록을 불러오는 중입니다...</div>
        ) : passports.length === 0 ? (
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
            신청 가능한 내 자산이 없습니다. 먼저 디지털 자산을 보유한 상태에서 다시 시도해주세요.
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="tracera-workflow-subtle">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="block text-sm font-semibold text-slate-700">신청할 자산 선택</label>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="tracera-workflow-button-secondary min-h-[44px] px-4 py-2"
                >
                  QR로 자산 선택
                </button>
              </div>
              <select
                value={selectedPassportId}
                onChange={(e) => setSelectedPassportId(e.target.value)}
                className="tracera-workflow-field bg-white"
              >
                {passports.map((passport) => (
                  <option key={passport.passportId} value={passport.passportId}>
                    {(passport.modelName || '이름 없는 자산')} / {passport.serialNumber || passport.passportId}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                직접 선택하거나 내 디지털 자산 공개 QR을 스캔해서 자동으로 자산을 고를 수 있습니다.
              </p>
            </div>

            {selectedPassport && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
                <div className="text-xs font-semibold text-amber-700">선택된 자산</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{selectedPassport.modelName || '-'}</div>
                <div className="mt-1 break-all text-xs text-slate-500">
                  Serial: {selectedPassport.serialNumber || '-'} | Passport: {selectedPassport.passportId}
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">요청 방식</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SERVICE_REQUEST_METHOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setServiceRequestMethod(option.value)}
                    className={`min-h-[72px] rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      serviceRequestMethod === option.value
                        ? 'border-amber-200 bg-amber-50 text-amber-900 shadow-[0_16px_40px_-28px_rgba(180,83,9,.18)]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">증상 설명</label>
              <textarea
                value={symptomDescription}
                onChange={(e) => setSymptomDescription(getTrimmedText(e.target.value, SYMPTOM_DESCRIPTION_MAX_LENGTH))}
                onPaste={(e) => handleLimitedPaste(e, symptomDescription, SYMPTOM_DESCRIPTION_MAX_LENGTH, setSymptomDescription)}
                rows={4}
                placeholder="예: 전원이 켜지지 않음, 화면이 깜빡임"
                className="tracera-workflow-field"
                maxLength={SYMPTOM_DESCRIPTION_MAX_LENGTH}
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>최대 {SYMPTOM_DESCRIPTION_MAX_LENGTH}자까지 입력할 수 있습니다.</span>
                <span>{symptomDescriptionLength}/{SYMPTOM_DESCRIPTION_MAX_LENGTH}</span>
              </div>
            </div>

            {serviceRequestMethod === 'VISIT' && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">희망 방문 일자 / 시간</label>
                <input
                  type="datetime-local"
                  value={requestedReservationAt}
                  onChange={(e) => setRequestedReservationAt(e.target.value)}
                  className="tracera-workflow-field"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">연락 메모</label>
              <textarea
                rows={3}
                value={contactMemo}
                onChange={(e) => setContactMemo(getTrimmedText(e.target.value, CONTACT_MEMO_MAX_LENGTH))}
                onPaste={(e) => handleLimitedPaste(e, contactMemo, CONTACT_MEMO_MAX_LENGTH, setContactMemo)}
                placeholder="예: 연락받을 연락처를 기재하세요. 가능한 시간대도 넣어주세요."
                className="tracera-workflow-field"
                maxLength={CONTACT_MEMO_MAX_LENGTH}
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>최대 {CONTACT_MEMO_MAX_LENGTH}자까지 입력할 수 있습니다.</span>
                <span>{contactMemoLength}/{CONTACT_MEMO_MAX_LENGTH}</span>
              </div>
            </div>

            <div className="tracera-workflow-subtle">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Paperclip size={16} className="text-amber-600" />
                신청 첨부파일
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                고장 사진, 참고 문서 등을 첨부할 수 있습니다. 업체 신청과 동일하게 파일을 먼저 고른 뒤, `서비스 요청하기`를 누를 때 업로드와 제출이 함께 진행됩니다.
              </p>
              {beforeEvidenceGroupId && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                  Evidence Group ID: <span className="font-mono text-slate-950">{beforeEvidenceGroupId}</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleSelectFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="tracera-workflow-button-secondary mt-4 min-h-[44px] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UploadCloud size={16} />
                {uploading ? '업로드 중...' : '파일 선택'}
              </button>
              {selectedFiles.length > 0 && (
                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-600">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-700">선택한 파일</div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFiles([]);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
                    >
                      전체 취소
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-800">{file.name}</div>
                          <div className="text-xs text-slate-500">{formatBytes(file.size)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedFile(index)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          취소
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 rounded-xl border border-green-100 bg-green-50 px-3 py-3 text-xs text-slate-600">
                  <div className="mb-2 font-semibold text-green-700">업로드 완료 파일</div>
                  {uploadedFiles.map((file) => (
                    <div key={file.evidenceId}>{file.fileName} ({formatBytes(file.sizeBytes)})</div>
                  ))}
                </div>
              )}
              {uploading && (
                <div className="mt-3 text-xs text-amber-700">
                  업로드 진행: {uploadProgress.done}/{uploadProgress.total}
                  {uploadProgress.current ? ` · ${uploadProgress.current}` : ''}
                </div>
              )}
              <div className="mt-2 text-xs text-slate-500">
                첨부파일은 최종 제출 시 업로드됩니다. 제출 전까지 파일 목록에서 자유롭게 취소할 수 있습니다.
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={submitting || !selectedPassportId || !provider?.address}
                className="tracera-workflow-button"
              >
                {submitting ? '요청 중...' : '서비스 요청하기'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/service-request/my')}
                className="tracera-workflow-button-secondary"
              >
                내 서비스 요청 보기
              </button>
            </div>
          </form>
        )}
      </section>
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleQrScanSuccess}
        title="내 자산 QR 스캔"
        description="서비스 신청할 제품의 QR을 스캔하면 자동으로 자산이 선택됩니다."
        tip="공개 QR을 카메라 중앙에 맞추면 현재 신청 화면으로 바로 돌아옵니다."
        uploadLabel="QR 이미지로 선택하기"
      />
    </div>
  );
};

export default ServiceProviderDetailPage;
