import React from 'react';
import { AlertCircle, CheckCircle2, FileText, UploadCloud, X } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

const parseErrorMessage = async (response) => {
  const prefix = `[${response.status}]`;
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const data = await response.json();
      const message = data?.message || data?.error || data?.code || data?.path;
      return message ? `${prefix} ${message}` : `${prefix} 요청 처리에 실패했습니다.`;
    }
    const text = await response.text();
    return text?.trim() ? `${prefix} ${text.slice(0, 160)}` : `${prefix} 요청 처리에 실패했습니다.`;
  } catch {
    return `${prefix} 요청 처리에 실패했습니다.`;
  }
};

const apiJson = async (url, token, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  if (response.status === 204) return null;
  return response.json();
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

  const handleUploadEvidence = async () => {
    setError('');
    setSuccess('');

    if (!accessToken) {
      openModal('안내', '로그인이 필요합니다.', 'alert');
      return;
    }
    if (selectedFiles.length === 0) {
      openModal('증빙 파일 확인', '업로드할 파일을 선택해주세요.', 'alert');
      return;
    }

    const filesToUpload = [...selectedFiles];
    let currentGroupId = evidenceGroupId || null;
    let uploadedCount = 0;

    setUploadProgress({ total: filesToUpload.length, done: 0, current: '' });
    setUploading(true);
    try {
      for (const file of filesToUpload) {
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
      const remaining = filesToUpload.slice(uploadedCount);
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
    <div className="relative max-w-7xl mx-auto py-10 px-4 md:px-6 space-y-8 [font-family:var(--claim-font,ui-sans-serif,system-ui)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_15%_10%,rgba(14,116,144,.16),transparent_42%),radial-gradient(circle_at_85%_0%,rgba(30,64,175,.12),transparent_36%)]" />
      <header className="rounded-3xl border border-slate-200/80 bg-[radial-gradient(circle_at_10%_10%,rgba(148,163,184,.24),transparent_42%),linear-gradient(135deg,#0f172a,#1e293b_55%,#334155)] p-7 md:p-9 text-white shadow-[0_24px_60px_-28px_rgba(15,23,42,.75)]">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">디지털 자산 등록하기</h1>
        <p className="text-slate-200 mt-3 text-sm md:text-base">
          구매 증빙 제출 후 디지털 자산을 직접 등록하세요.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <section className="bg-white/95 backdrop-blur rounded-3xl border border-slate-200 p-6 md:p-7 shadow-[0_18px_40px_-28px_rgba(15,23,42,.65)] space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-white text-sm font-bold flex items-center justify-center shadow-sm">1</div>
          <h2 className="text-lg md:text-xl font-semibold text-slate-900">등록 신청 정보 입력</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block text-slate-600 mb-1.5 font-medium">시리얼 번호</span>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full border border-slate-300/90 rounded-xl px-3 py-2.5 outline-none bg-white focus:ring-2 focus:ring-slate-900/15 focus:border-slate-700"
              placeholder="예: SN-001"
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1.5 font-medium">모델명</span>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full border border-slate-300/90 rounded-xl px-3 py-2.5 outline-none bg-white focus:ring-2 focus:ring-slate-900/15 focus:border-slate-700"
              placeholder="예: Model X"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="block text-slate-600 mb-1.5 font-medium">신청 안내</span>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              입력한 시리얼/모델명과 증빙 파일을 기반으로 등록 심사가 진행됩니다.
            </div>
          </label>
        </div>
      </section>

      <section className="bg-white/95 backdrop-blur rounded-3xl border border-slate-200 p-6 md:p-7 shadow-[0_18px_40px_-28px_rgba(15,23,42,.65)] space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-white text-sm font-bold flex items-center justify-center shadow-sm">2</div>
          <h2 className="text-lg md:text-xl font-semibold text-slate-900">증빙 파일 제출</h2>
        </div>

        {evidenceGroupId && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Evidence Group ID
            <div className="font-mono font-semibold break-all text-slate-900 mt-1">{evidenceGroupId}</div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
        />

        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100/70 p-5 md:p-6">
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
                  <p className="text-xs text-blue-700 mt-1">
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
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-100 shadow-sm"
              >
                파일 선택
              </button>
              {selectedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFiles([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-600 text-sm hover:bg-slate-100"
                  title="선택 해제"
                >
                  <X size={14} />
                </button>
              )}
              <button
                onClick={handleUploadEvidence}
                disabled={uploading || selectedFiles.length === 0}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold disabled:opacity-50 shadow-[0_10px_20px_-12px_rgba(37,99,235,.8)]"
              >
                {uploading ? '제출 중...' : `${selectedFiles.length || 0}개 증빙 파일 제출`}
              </button>
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

        <button
          onClick={handleSubmitClaim}
          disabled={submitting || !evidenceGroupId}
          className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 text-white text-sm font-semibold disabled:opacity-50 shadow-[0_14px_30px_-16px_rgba(15,23,42,.8)]"
          title={!evidenceGroupId ? '증빙 파일 제출 완료 후 신청할 수 있습니다.' : ''}
        >
          {submitting ? '제출 중...' : '디지털 자산 등록 신청하기'}
        </button>
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
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 text-white text-sm font-semibold"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseClaimView;
