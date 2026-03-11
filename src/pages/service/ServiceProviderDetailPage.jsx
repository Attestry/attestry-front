import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  const load = async () => {
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
  };

  useEffect(() => {
    load().catch(() => {});
  }, [tenantId, preselectedPassportId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPassportId || !provider?.tenantId) return;
    if (!provider?.address) {
      setError('업체 주소가 등록되지 않아 서비스 신청을 진행할 수 없습니다.');
      return;
    }
    if (!beforeEvidenceGroupId) {
      setError('신청 첨부파일을 먼저 업로드해주세요.');
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

    setSubmitting(true);
    setError('');
    setSubmitMessage('');
    try {
      const response = await submitServiceRequest(selectedPassportId, provider.tenantId, {
        beforeEvidenceGroupId: beforeEvidenceGroupId || null,
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
      setError('업로드할 첨부파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    setError('');
    setSubmitMessage('');
    try {
      const result = await uploadEvidenceFiles({
        files: filesToUpload,
        initialEvidenceGroupId: beforeEvidenceGroupId || null,
        presign: presignOwnerServiceEvidence,
        complete: completeOwnerServiceEvidence,
        onProgress: setUploadProgress,
      });
      setBeforeEvidenceGroupId(result.evidenceGroupId || '');
      setUploadedFiles((prev) => [...prev, ...result.uploadedFiles]);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSubmitMessage('신청 첨부파일 업로드가 완료되었습니다.');
    } catch (e) {
      setError(e?.message || '첨부파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setUploadProgress({ total: 0, done: 0, current: '' });
    }
  };

  const handleSelectFiles = (files) => {
    const nextFiles = Array.from(files || []);
    setSelectedFiles(nextFiles);
    if (nextFiles.length === 0) {
      return;
    }
    handleUploadEvidence(nextFiles).catch(() => {});
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/service-request/providers')}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft size={16} />
            서비스 업체 목록으로
          </button>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">{provider?.name || '서비스 업체'}</h1>
          <div className="mt-2 inline-flex items-center gap-1 text-sm text-gray-500">
            <MapPin size={14} />
            {provider?.region || '지역 정보 없음'}
          </div>
          <p className="mt-2 text-xs text-gray-400">Tenant ID: {provider?.tenantId || tenantId}</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
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

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Wrench size={18} className="text-amber-600" />
          <h2 className="text-lg font-bold text-gray-900">서비스 업체 정보</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs font-semibold text-gray-500">업체명</div>
            <div className="mt-2 text-sm font-semibold text-gray-900">{provider?.name || '-'}</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs font-semibold text-gray-500">지역</div>
            <div className="mt-2 text-sm font-semibold text-gray-900">{provider?.region || '-'}</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 md:col-span-2">
            <div className="text-xs font-semibold text-gray-500">주소</div>
            <div className="mt-2 text-sm font-semibold text-gray-900">{provider?.address || '-'}</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-amber-600" />
          <h2 className="text-lg font-bold text-gray-900">서비스 신청하기</h2>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          내 자산을 선택하고 요청 방식, 증상 설명, 연락 정보, 첨부파일과 함께 서비스 요청을 생성합니다.
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
            <div>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="block text-sm font-semibold text-gray-700">신청할 자산 선택</label>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  QR로 자산 선택
                </button>
              </div>
              <select
                value={selectedPassportId}
                onChange={(e) => setSelectedPassportId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              >
                {passports.map((passport) => (
                  <option key={passport.passportId} value={passport.passportId}>
                    {(passport.modelName || '이름 없는 자산')} / {passport.serialNumber || passport.passportId}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                직접 선택하거나 내 디지털 자산 공개 QR을 스캔해서 자동으로 자산을 고를 수 있습니다.
              </p>
            </div>

            {selectedPassport && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                <div className="text-xs font-semibold text-gray-500">선택된 자산</div>
                <div className="mt-2 text-sm font-semibold text-gray-900">{selectedPassport.modelName || '-'}</div>
                <div className="mt-1 text-xs text-gray-500">
                  Serial: {selectedPassport.serialNumber || '-'} | Passport: {selectedPassport.passportId}
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">요청 방식</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SERVICE_REQUEST_METHOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setServiceRequestMethod(option.value)}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      serviceRequestMethod === option.value
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">증상 설명</label>
              <textarea
                value={symptomDescription}
                onChange={(e) => setSymptomDescription(e.target.value)}
                rows={4}
                placeholder="예: 전원이 켜지지 않음, 화면이 깜빡임"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            {serviceRequestMethod === 'VISIT' && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">희망 방문 일자 / 시간</label>
                <input
                  type="datetime-local"
                  value={requestedReservationAt}
                  onChange={(e) => setRequestedReservationAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">연락 메모</label>
              <textarea
                rows={3}
                value={contactMemo}
                onChange={(e) => setContactMemo(e.target.value)}
                placeholder="예: 연락받을 연락처를 기재하세요. 가능한 시간대도 넣어주세요."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Paperclip size={16} className="text-amber-600" />
                신청 첨부파일
              </div>
              <p className="mt-2 text-xs text-gray-500">
                고장 사진, 참고 문서 등을 첨부할 수 있습니다. 파일을 선택하면 바로 업로드되고, 업로드 완료 후 `서비스 요청하기`로 제출합니다.
              </p>
              {beforeEvidenceGroupId && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                  Evidence Group ID: <span className="font-mono text-gray-900">{beforeEvidenceGroupId}</span>
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
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UploadCloud size={16} />
                {uploading ? '업로드 중...' : '파일 선택'}
              </button>
              {selectedFiles.length > 0 && (
                <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 text-xs text-gray-600">
                  <div className="mb-2 font-semibold text-gray-700">선택한 파일</div>
                  {selectedFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`}>{file.name} ({formatBytes(file.size)})</div>
                  ))}
                </div>
              )}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 rounded-lg border border-green-100 bg-green-50 px-3 py-3 text-xs text-gray-600">
                  <div className="mb-2 font-semibold text-green-700">업로드 완료 파일</div>
                  {uploadedFiles.map((file) => (
                    <div key={file.evidenceId}>{file.fileName} ({formatBytes(file.sizeBytes)})</div>
                  ))}
                </div>
              )}
              {uploading && (
                <div className="mt-3 text-xs text-blue-700">
                  업로드 진행: {uploadProgress.done}/{uploadProgress.total}
                  {uploadProgress.current ? ` · ${uploadProgress.current}` : ''}
                </div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                파일 선택 후 자동 업로드됩니다. 업로드 완료 후 아래 `서비스 요청하기`로 최종 제출됩니다.
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={submitting || !selectedPassportId || !provider?.address}
                className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? '요청 중...' : '서비스 요청하기'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/service-request/my')}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
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
      />
    </div>
  );
};

export default ServiceProviderDetailPage;
