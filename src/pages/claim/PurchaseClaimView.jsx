import React from 'react';
import { AlertCircle, CheckCircle2, FileText, UploadCloud, X } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { apiFetchJson } from '../../utils/api';
import { normalizeApiErrorMessage } from '../../utils/permissionUi';

const parseErrorMessage = async (response) => {
  const prefix = `[${response.status}]`;
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const data = await response.json();
      const message = data?.message || data?.error || data?.code || data?.path;
      return normalizeApiErrorMessage(message ? `${prefix} ${message}` : '', response.status, '요청 처리에 실패했습니다.');
    }
    const text = await response.text();
    return normalizeApiErrorMessage(text?.trim() ? `${prefix} ${text.slice(0, 160)}` : '', response.status, '요청 처리에 실패했습니다.');
  } catch {
    return normalizeApiErrorMessage('', response.status, '요청 처리에 실패했습니다.');
  }
};

const apiJson = async (url, token, options = {}) => {
  try {
    return await apiFetchJson(url, options, { token });
  } catch (error) {
    throw new Error(normalizeApiErrorMessage(error?.message, error?.status, '요청 처리에 실패했습니다.'));
  }
};

const toSha256Hex = async (file) => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${value.toFixed(unitIdx === 0 ? 0 : 1)} ${units[unitIdx]}`;
};

const PurchaseClaimView = () => {
  const { isAuthenticated, accessToken } = useAuthStore();
  const fileInputRef = React.useRef(null);

  const [serialNumber, setSerialNumber] = React.useState('');
  const [modelName, setModelName] = React.useState('');
  const [evidenceGroupId, setEvidenceGroupId] = React.useState('');
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [uploadedEvidences, setUploadedEvidences] = React.useState([]);
  const [uploadProgress, setUploadProgress] = React.useState({ total: 0, done: 0, current: '' });
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [modal, setModal] = React.useState({ open: false, title: '', message: '', tone: 'success' });

  const openModal = React.useCallback((title, message, tone = 'success') => {
    setModal({ open: true, title, message, tone });
  }, []);

  const handleUploadEvidence = async (selectedFilesOverride = null) => {
    setError('');
    setSuccess('');

    if (!accessToken) {
      openModal('안내', '로그인이 필요합니다.', 'alert');
      return;
    }
    const filesToUpload = selectedFilesOverride || selectedFiles;
    if (filesToUpload.length === 0) {
      openModal('증빙 파일 확인', '업로드할 파일을 선택해주세요.', 'alert');
      return;
    }

    const pendingFiles = [...filesToUpload];
    let currentGroupId = evidenceGroupId || null;
    let uploadedCount = 0;

    setUploadProgress({ total: pendingFiles.length, done: 0, current: '' });
    setUploading(true);
    try {
      for (const file of pendingFiles) {
        setUploadProgress((prev) => ({ ...prev, current: file.name }));
        const contentType = file.type || 'application/octet-stream';

        const presign = await apiJson('/workflows/purchase-claims/evidence/presign', accessToken, {
          method: 'POST',
          body: JSON.stringify({
            evidenceGroupId: currentGroupId,
            fileName: file.name,
            contentType,
          }),
        });

        const uploadResponse = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: file,
        });
        if (!uploadResponse.ok) {
          throw new Error(`${file.name}: 증빙 파일 업로드(PUT)에 실패했습니다.`);
        }

        const fileHash = await toSha256Hex(file);

        const complete = await apiJson('/workflows/purchase-claims/evidence/complete', accessToken, {
          method: 'POST',
          body: JSON.stringify({
            evidenceGroupId: presign.evidenceGroupId,
            evidenceId: presign.evidenceId,
            sizeBytes: file.size,
            fileHash,
          }),
        });

        currentGroupId = presign.evidenceGroupId;
        uploadedCount += 1;
        setEvidenceGroupId(presign.evidenceGroupId);
        setUploadedEvidences((prev) => [
          ...prev,
          {
            evidenceId: complete.evidenceId,
            fileName: file.name,
            sizeBytes: file.size,
            status: complete.status,
          },
        ]);
        setUploadProgress((prev) => ({ ...prev, done: uploadedCount }));
      }

      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccess(`${uploadedCount}개 증빙 파일 제출이 완료되었습니다.`);
      openModal('증빙 제출 완료', `${uploadedCount}개 파일이 정상 제출되었습니다.`);
    } catch (e) {
      const remaining = pendingFiles.slice(uploadedCount);
      setSelectedFiles(remaining);
      setError(e.message);
      if (uploadedCount > 0) {
        setSuccess(`${uploadedCount}개 파일은 제출 완료, 나머지 파일은 다시 제출해주세요.`);
      }
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

  const handleSubmitClaim = async () => {
    setError('');
    setSuccess('');

    if (!accessToken) {
      openModal('안내', '로그인이 필요합니다.', 'alert');
      return;
    }
    if (!serialNumber.trim() || !modelName.trim()) {
      openModal('입력 정보 확인', '시리얼 번호와 모델명을 모두 입력해주세요.', 'alert');
      return;
    }
    if (!evidenceGroupId) {
      openModal('증빙 파일 확인', '증빙 파일 제출을 먼저 완료해주세요.', 'alert');
      return;
    }

    setSubmitting(true);
    try {
      const submitted = await apiJson('/workflows/purchase-claims', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          serialNumber: serialNumber.trim(),
          modelName: modelName.trim(),
          evidenceGroupId,
          note: null,
        }),
      });

      setSerialNumber('');
      setModelName('');
      setEvidenceGroupId('');
      setUploadedEvidences([]);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccess('');
      openModal(
        '신청 완료',
        `Claim ID: ${submitted?.claimId || '-'} / 상태: ${submitted?.status || '-'}`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-6 text-center text-gray-500">
        디지털 자산 등록은 로그인 후 이용 가능합니다.
      </div>
    );
  }

  return (
    <div className="tracera-page-shell [font-family:var(--claim-font,ui-sans-serif,system-ui)]">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 lg:px-8">
      <header className="tracera-page-hero">
        <div className="tracera-page-tag">
          PRODUCT CLAIM
        </div>
        <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-[-0.055em] text-slate-950">제품 등록 신청</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
          시리얼 정보와 구매 증빙을 제출하면, 등록 심사와 디지털 자산 발급 흐름이 같은 톤 안에서 깔끔하게 이어집니다.
        </p>
      </header>

      {error && (
        <div className="tracera-page-card-soft rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="tracera-page-card-soft rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <section className="tracera-page-card space-y-5 p-5 md:p-6">
        <div className="flex items-center gap-3">
          <div className="tracera-workflow-step">1</div>
          <h2 className="text-lg md:text-xl font-semibold text-slate-900">등록 신청 정보 입력</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block text-slate-600 mb-1.5 font-medium">시리얼 번호</span>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="tracera-workflow-field"
              placeholder="예: SN-001"
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1.5 font-medium">모델명</span>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="tracera-workflow-field"
              placeholder="예: Model X"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="block text-slate-600 mb-1.5 font-medium">신청 안내</span>
            <div className="tracera-workflow-subtle text-sm text-slate-600">
              입력한 시리얼/모델명과 증빙 파일을 기반으로 등록 심사가 진행됩니다.
            </div>
          </label>
        </div>
      </section>

      <section className="tracera-page-card space-y-5 p-5 md:p-6">
        <div className="flex items-center gap-3">
          <div className="tracera-workflow-step">2</div>
          <h2 className="text-lg md:text-xl font-semibold text-slate-900">증빙 파일 제출</h2>
        </div>

        {evidenceGroupId && (
          <div className="tracera-workflow-subtle text-sm text-slate-700">
            Evidence Group ID
            <div className="font-mono font-semibold break-all text-slate-900 mt-1">{evidenceGroupId}</div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleSelectFiles(e.target.files)}
        />

        <div className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#f8fafc)] p-5 md:p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                <UploadCloud size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">증빙 파일 선택</p>
                {selectedFiles.length > 0 ? (
                  <p className="text-sm text-slate-600 mt-1">
                    총 {selectedFiles.length}개 파일 선택됨
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 mt-1">PNG, JPG, PDF 등 증빙 파일을 여러 개 선택할 수 있습니다.</p>
                )}
                <p className="text-xs text-slate-500 mt-1">(영수증, 인보이스 등 첨부해주세요.)</p>
                {uploading && (
                  <p className="text-xs text-amber-700 mt-1">
                    업로드 진행: {uploadProgress.done}/{uploadProgress.total}
                    {uploadProgress.current ? ` · ${uploadProgress.current}` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="tracera-workflow-button-secondary min-h-[44px] px-4 py-2"
              >
                {uploading ? '제출 중...' : '파일 선택'}
              </button>
              {selectedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFiles([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
                  title="선택 해제"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <ul className="space-y-2">
            {selectedFiles.map((f, idx) => (
              <li key={`${f.name}-${f.size}-${idx}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white">
                <div className="flex items-center gap-2 text-slate-700 min-w-0">
                  <FileText size={15} />
                  <span className="font-medium break-all">{f.name}</span>
                  <span className="text-slate-400">({formatBytes(f.size)})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-slate-700"
                  title="선택 목록에서 제거"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {uploadedEvidences.length > 0 && (
          <ul className="space-y-2">
            {uploadedEvidences.map((e) => (
              <li key={e.evidenceId} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white shadow-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <FileText size={15} />
                  <span className="font-medium">{e.fileName}</span>
                  <span className="text-slate-400">({formatBytes(e.sizeBytes)})</span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 size={12} />
                  {e.status}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="tracera-workflow-actionbar">
          <p className="text-sm leading-6 text-slate-600">
            증빙 업로드가 완료되면 바로 등록 신청을 제출할 수 있습니다.
          </p>
          <button
            onClick={handleSubmitClaim}
            disabled={submitting || !evidenceGroupId}
            className="tracera-workflow-button w-full md:w-auto shadow-[0_14px_30px_-16px_rgba(15,23,42,.8)]"
            title={!evidenceGroupId ? '증빙 파일 제출 완료 후 신청할 수 있습니다.' : ''}
          >
            {submitting ? '제출 중...' : '디지털 자산 등록 신청하기'}
          </button>
        </div>
      </section>

      {modal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="min-h-full flex items-center justify-center">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,.7)] p-6">
              <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center mb-4 ${modal.tone === 'alert' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                {modal.tone === 'alert' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <h3 className="text-lg font-bold text-slate-900">{modal.title}</h3>
              <p className="text-sm text-slate-600 mt-2">{modal.message}</p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setModal({ open: false, title: '', message: '', tone: 'success' })}
                  className="px-4 py-2 rounded-xl text-white text-sm font-semibold bg-[linear-gradient(135deg,#221d1a_0%,#3a312b_100%)]"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default PurchaseClaimView;
