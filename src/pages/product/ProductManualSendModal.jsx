import React, { useState } from 'react';
import { AlertCircle, FileText, Loader2, Send, Upload, X } from 'lucide-react';
import { formatBytes, uploadEvidenceFiles } from '../service/serviceEvidenceUpload';
import {
  completePassportManualEvidence,
  presignPassportManualEvidence,
  sendPassportManual,
} from './productManualApi';

const MAX_MESSAGE_LENGTH = 2000;

const trimToMaxLength = (value) => String(value || '').slice(0, MAX_MESSAGE_LENGTH);

const ProductManualSendModal = ({
  isOpen,
  onClose,
  tenantId,
  passportId,
  productLabel,
  recipientEmailMasked,
  onSent,
}) => {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [lastEvidenceGroupId, setLastEvidenceGroupId] = useState(null);

  if (!isOpen) {
    return null;
  }

  const resetState = () => {
    setMessage('');
    setFiles([]);
    setUploadedFiles([]);
    setSubmitting(false);
    setError('');
    setUploadProgress(null);
    setLastEvidenceGroupId(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetState();
    onClose();
  };

  const handleFileChange = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    if (!nextFiles.length) return;
    setFiles((prev) => [...prev, ...nextFiles]);
    event.target.value = '';
  };

  const handleRemoveFile = (indexToRemove) => {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handlePaste = (event) => {
    const pastedText = event.clipboardData?.getData('text') || '';
    const selectionStart = event.target.selectionStart ?? message.length;
    const selectionEnd = event.target.selectionEnd ?? message.length;
    const nextValue = `${message.slice(0, selectionStart)}${pastedText}${message.slice(selectionEnd)}`;
    if (nextValue.length <= MAX_MESSAGE_LENGTH) {
      return;
    }
    event.preventDefault();
    const allowed = MAX_MESSAGE_LENGTH - (message.length - (selectionEnd - selectionStart));
    if (allowed <= 0) return;
    const clipped = pastedText.slice(0, allowed);
    const safeValue = `${message.slice(0, selectionStart)}${clipped}${message.slice(selectionEnd)}`;
    setMessage(safeValue);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedMessage = message.trim();
    if (!normalizedMessage && files.length === 0) {
      setError('메뉴얼 내용을 입력하거나 첨부 파일을 추가해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let evidenceGroupId = lastEvidenceGroupId;
      if (files.length > 0) {
        const uploadResult = await uploadEvidenceFiles({
          files,
          initialEvidenceGroupId: evidenceGroupId,
          presign: (payload) => presignPassportManualEvidence(tenantId, payload),
          complete: (payload) => completePassportManualEvidence(tenantId, payload),
          onProgress: setUploadProgress,
        });
        evidenceGroupId = uploadResult.evidenceGroupId;
        setLastEvidenceGroupId(evidenceGroupId);
        setUploadedFiles((prev) => [...prev, ...files.map((file) => ({
          fileName: file.name,
          sizeBytes: file.size,
        }))]);
        setFiles([]);
      }

      await sendPassportManual(tenantId, passportId, {
        message: normalizedMessage || null,
        evidenceGroupId,
      });

      onSent?.();
      handleClose();
    } catch (submitError) {
      setError(submitError.message || '메뉴얼 전송에 실패했습니다.');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,.35)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">메뉴얼 보내기</h2>
            <p className="mt-1 text-sm text-slate-500">
              현재 소유자 {recipientEmailMasked ? `(${recipientEmailMasked})` : ''}에게 제품 메뉴얼을 전달합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">{productLabel}</p>
            <p className="mt-1 text-xs text-slate-500">직접 작성한 안내와 첨부 파일을 함께 보낼 수 있습니다.</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">메뉴얼 안내</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(trimToMaxLength(event.target.value))}
              onPaste={handlePaste}
              rows={6}
              maxLength={MAX_MESSAGE_LENGTH}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="현재 소유자에게 전달할 제품 메뉴얼 안내를 입력해주세요."
            />
            <div className="mt-2 text-right text-xs text-slate-400">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">첨부 파일</label>
            <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
              <Upload size={18} />
              파일 첨부하기
              <input type="file" multiple className="hidden" onChange={handleFileChange} />
            </label>

            {[...uploadedFiles, ...files.map((file) => ({ fileName: file.name, sizeBytes: file.size, pending: true }))].length > 0 && (
              <ul className="mt-3 space-y-2">
                {[...uploadedFiles, ...files.map((file) => ({ fileName: file.name, sizeBytes: file.size, pending: true }))].map((file, index) => (
                  <li key={`${file.fileName}-${file.sizeBytes}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                        <FileText size={16} className="text-blue-500" />
                        <span className="truncate">{file.fileName}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {formatBytes(file.sizeBytes)}
                        {file.pending ? ' · 업로드 대기' : ' · 업로드 완료'}
                      </div>
                    </div>
                    {file.pending ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index - uploadedFiles.length)}
                        className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                        aria-label="첨부 삭제"
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        첨부됨
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {uploadProgress && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              첨부 업로드 중: {uploadProgress.done}/{uploadProgress.total}
              {uploadProgress.current ? ` (${uploadProgress.current})` : ''}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              메뉴얼 보내기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductManualSendModal;
