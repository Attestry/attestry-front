import React, { useState } from 'react';
import { AlertCircle, FileText, X } from 'lucide-react';

const ReasonModal = ({
  isOpen,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  placeholder,
  initialValue = '',
  errorMessage = '사유를 입력해주세요.',
  loading = false,
  tone = 'service',
  onClose,
  onConfirm,
}) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isDanger = tone === 'danger';
  const accent = isDanger
    ? {
        chip: 'border-rose-100 bg-rose-50 text-rose-700',
        icon: 'bg-[linear-gradient(135deg,#e11d48,#fb7185)]',
        primaryButton: 'bg-rose-600 hover:bg-rose-700',
      }
    : {
        chip: 'border-amber-100 bg-amber-50 text-amber-700',
        icon: 'bg-[linear-gradient(135deg,#C27A2C,#E5B15C)]',
        primaryButton: 'bg-slate-950 hover:bg-slate-800',
      };

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(errorMessage);
      return;
    }
    setError('');
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_40px_100px_-32px_rgba(15,23,42,.28)]">
        <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#fffdf8,#ffffff)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className={`rounded-2xl p-3 text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,.28)] ${accent.icon}`}>
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.16em] ${accent.chip}`}>
                  <AlertCircle size={12} />
                  REASON INPUT
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              사유 입력
            </label>
            <textarea
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError('');
              }}
              placeholder={placeholder}
              rows={5}
              disabled={loading}
              className={`w-full resize-none rounded-[1.25rem] border px-4 py-3 text-sm leading-6 outline-none transition ${
                error
                  ? 'border-rose-300 bg-rose-50 text-slate-900 focus:border-rose-400'
                  : 'border-slate-200 bg-white text-slate-900 focus:border-slate-400'
              } disabled:cursor-not-allowed disabled:bg-slate-50`}
            />
            {error ? (
              <p className="mt-2 text-sm text-rose-600">{error}</p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">간단하고 명확하게 사유를 남겨주세요.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${accent.primaryButton}`}
          >
            {loading ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReasonModal;
