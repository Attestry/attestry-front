import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Camera,
  Keyboard,
  ScanLine,
  ShieldCheck,
  CheckCircle2,
  CircleAlert,
  Lock,
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import QRScannerModal from '../../components/shipment/QRScannerModal';
import { parseTransferQrPayload } from '../../utils/qrPayload';
import { apiFetchJson } from '../../utils/api';
import { normalizeApiErrorMessage } from '../../utils/permissionUi';

const apiJson = async (url, token, options = {}) => {
  try {
    return await apiFetchJson(url, options, { token });
  } catch (error) {
    throw new Error(normalizeApiErrorMessage(error?.message, error?.status, '요청 처리에 실패했습니다.'));
  }
};

const parseReceiveCode = (value) => {
  const raw = String(value || '').trim();
  const decodeBase64Url = (encodedPart) => {
    const encoded = encodedPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
    return atob(padded);
  };

  if (raw.startsWith('TR2.')) {
    try {
      const binary = decodeBase64Url(raw.slice(4));
      if (binary.length !== 24) return null;
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const hex = Array.from(bytes.slice(0, 16))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const transferId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      const password = String.fromCharCode(...bytes.slice(16, 24)).trim();
      if (!transferId || !password) return null;
      return { transferId, password };
    } catch {
      return null;
    }
  }

  if (raw.startsWith('TR1.')) {
    try {
      const decoded = decodeBase64Url(raw.slice(4));
      const sep = decoded.indexOf(':');
      if (sep <= 0 || sep >= decoded.length - 1) return null;
      const transferId = decoded.slice(0, sep).trim();
      const password = decoded.slice(sep + 1).trim();
      if (!transferId || !password) return null;
      return { transferId, password };
    } catch {
      return null;
    }
  }

  return null;
};

const TransferReceiveView = () => {
  const { isAuthenticated, accessToken } = useAuthStore();
  const [searchParams] = useSearchParams();
  const { transferId: pathTransferId, qrNonce: pathQrNonce } = useParams();

  const [mode, setMode] = React.useState('QR');
  const [transferId, setTransferId] = React.useState(pathTransferId || searchParams.get('transferId') || '');
  const [password, setPassword] = React.useState('');
  const queryQrNonce = pathQrNonce || searchParams.get('qrNonce') || searchParams.get('nonce') || '';

  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [scannerStatus, setScannerStatus] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState(null);

  const autoSubmittingRef = React.useRef(false);
  const autoAcceptFromQueryTriedRef = React.useRef(false);

  const playScannerSuccessFeedback = React.useCallback(() => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([90, 40, 120]);
      }
    } catch {
      // ignore vibration errors
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.13);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1175, now + 0.1);
      gain2.gain.setValueAtTime(0.0001, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.1, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.21);

      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 350);
    } catch {
      // ignore audio errors
    }
  }, []);

  const closeScanner = React.useCallback(() => {
    setScannerOpen(false);
  }, []);

  const closeCompletionModal = React.useCallback(() => {
    setResult(null);
  }, []);

  const acceptTransfer = React.useCallback(async ({ acceptMethod, transferIdValue, nonceValue, passwordValue, auto = false }) => {
    setError('');
    setResult(null);

    if (!accessToken) {
      setError('로그인이 필요합니다.');
      return;
    }

    const finalTransferId = String(transferIdValue || '').trim();
    if (!finalTransferId) {
      setError('이전 식별자(Transfer ID)를 확인할 수 없습니다.');
      return;
    }

    if (acceptMethod === 'QR' && !String(nonceValue || '').trim()) {
      setError('유효한 QR nonce를 인식하지 못했습니다.');
      return;
    }

    if (acceptMethod === 'CODE' && !String(passwordValue || '').trim()) {
      setError('이전 코드를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const body = acceptMethod === 'QR'
        ? { qrNonce: String(nonceValue).trim() }
        : { password: String(passwordValue).trim() };

      const data = await apiJson(`/workflows/transfers/${encodeURIComponent(finalTransferId)}/accept`, accessToken, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (auto) playScannerSuccessFeedback();

      setResult(data);
      setScannerStatus(auto ? 'QR 인식 및 소유권 인증이 완료되었습니다.' : '소유권 인증이 완료되었습니다.');
      setPassword('');
      closeScanner();
    } catch (e) {
      setError(e.message || '이전 수락 요청 중 오류가 발생했습니다.');
      setScannerStatus('유효하지 않거나 이미 처리된 요청일 수 있습니다.');
    } finally {
      setSubmitting(false);
      autoSubmittingRef.current = false;
    }
  }, [accessToken, closeScanner, playScannerSuccessFeedback]);

  React.useEffect(() => {
    if (autoAcceptFromQueryTriedRef.current) return;
    if (!accessToken || !transferId.trim() || !queryQrNonce.trim()) return;

    autoAcceptFromQueryTriedRef.current = true;
    setMode('QR');
    setScannerStatus('링크 정보를 확인했습니다. 소유권 인증을 진행합니다...');

    void acceptTransfer({
      acceptMethod: 'QR',
      transferIdValue: transferId,
      nonceValue: queryQrNonce,
      auto: true,
    });
  }, [accessToken, acceptTransfer, queryQrNonce, transferId]);

  const startScanner = React.useCallback(() => {
    setScannerStatus('');
    setError('');
    setScannerOpen(true);
    setScannerStatus('제시받은 QR 코드를 스캔하면 소유권 인증이 이어집니다.');
  }, []);

  React.useEffect(() => {
    if (mode !== 'QR') {
      closeScanner();
    }
  }, [mode, closeScanner]);

  const handleQrScanSuccess = React.useCallback(async (decodedText) => {
    if (autoSubmittingRef.current || submitting) return;

    const parsed = parseTransferQrPayload(decodedText);
    const detectedTransferId = parsed.transferId || transferId;
    const detectedNonce = parsed.qrNonce;

    if (!detectedTransferId || !detectedNonce) {
      setError('유효한 이전 QR이 아닙니다. 다시 스캔하거나 수락코드를 입력해주세요.');
      setScannerStatus('이전용 QR 코드만 인식할 수 있습니다.');
      return;
    }

    setTransferId(detectedTransferId);
    autoSubmittingRef.current = true;
    setScannerStatus('유효성 확인 완료. 소유권 이전 처리 중...');

    await acceptTransfer({
      acceptMethod: 'QR',
      transferIdValue: detectedTransferId,
      nonceValue: detectedNonce,
      auto: true,
    });
  }, [acceptTransfer, submitting, transferId]);

  const onSubmitCode = async (e) => {
    e.preventDefault();
    const enteredCode = password.trim();
    if (!enteredCode) {
      setError('이전 코드를 입력해주세요.');
      return;
    }

    let finalTransferId = transferId.trim();
    let finalPassword = enteredCode;

    if (!finalTransferId) {
      const parsed = parseReceiveCode(enteredCode);
      if (!parsed) {
        setError('유효한 이전 코드가 아닙니다. 발급받은 수락코드를 확인해주세요.');
        return;
      }
      finalTransferId = parsed.transferId;
      finalPassword = parsed.password;
    }

    await acceptTransfer({ acceptMethod: 'CODE', transferIdValue: finalTransferId, passwordValue: finalPassword });
  };

  return (
    <div className="tracera-page-shell min-h-[calc(100vh-64px)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6 md:py-12 space-y-6">
        <header className="tracera-page-hero">
          <div className="relative space-y-3">
            <div className="tracera-page-tag">
              <ShieldCheck size={14} /> OWNERSHIP TRANSFER
            </div>
            <h1 className="tracera-keepall text-3xl font-semibold leading-tight tracking-[-0.055em] text-slate-950 sm:text-[2.5rem]">
              제품의 소유권을 안전하게 인증하고
              <span className="block text-slate-600">내 계정으로 안전하게 이전하세요</span>
            </h1>
            <p className="tracera-keepall max-w-2xl text-sm leading-7 text-slate-600">
              현장 스캔과 수락코드 입력 모두 같은 보안 흐름으로 처리됩니다. 어떤 방식이든 이전 기록은 동일한 기준으로 남습니다.
            </p>
          </div>
        </header>

        {!isAuthenticated && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            로그인 후 이용 가능합니다. <Link className="font-semibold underline" to="/login">로그인하기</Link>
          </div>
        )}

        <section className="tracera-page-card space-y-4 p-5 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setMode('QR')}
              className={`group min-h-[112px] rounded-[1.5rem] border p-5 text-left transition ${mode === 'QR' ? 'border-amber-200 bg-[linear-gradient(160deg,#fffaf2,#f6efe6)] text-[#5f4637] shadow-[0_16px_40px_-28px_rgba(120,83,51,.24)]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-2 text-base font-semibold"><Camera size={18} /> QR 스캔</div>
              <p className="mt-2 text-sm opacity-80">제시받은 QR 코드를 스캔하면 소유권 인증이 이어집니다.</p>
            </button>

            <button
              type="button"
              onClick={() => setMode('CODE')}
              className={`group min-h-[112px] rounded-[1.5rem] border p-5 text-left transition ${mode === 'CODE' ? 'border-amber-200 bg-[linear-gradient(160deg,#fffaf2,#f6efe6)] text-[#5f4637] shadow-[0_16px_40px_-28px_rgba(120,83,51,.24)]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-2 text-base font-semibold"><Keyboard size={18} /> 코드 입력</div>
              <p className="mt-2 text-sm opacity-80">전달받은 수락코드로 소유권 인증을 진행합니다.</p>
            </button>
          </div>
        </section>

        {mode === 'QR' ? (
          <section className="tracera-page-card p-5 md:p-6">
            <div className="relative mx-auto max-w-xl">
              <div className="absolute inset-0 -z-10 rounded-3xl bg-[radial-gradient(circle_at_50%_0,rgba(191,146,105,.22),transparent_62%)]" />
              <button
                type="button"
                onClick={startScanner}
                disabled={!isAuthenticated || submitting}
                className="group flex w-full flex-col items-center justify-center gap-3 rounded-[1.75rem] border border-amber-200 bg-[linear-gradient(160deg,#fffdf8_0%,#f8f2e9_72%,#efe3d5_100%)] px-8 py-14 text-center shadow-[0_22px_48px_-30px_rgba(120,83,51,.28)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_54px_-28px_rgba(120,83,51,.34)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(135deg,#111827_0%,#6f5748_100%)] text-white shadow-lg">
                  <ScanLine size={30} />
                </span>
                <span className="text-xl font-bold tracking-tight text-slate-900">스캐너 시작</span>
                <span className="whitespace-nowrap text-sm text-slate-600">카메라가 열리면 QR을 중앙 프레임에 맞춰주세요</span>
              </button>
            </div>

            {scannerStatus && <p className="mt-4 text-center text-sm text-[#7a5940]">{scannerStatus}</p>}
          </section>
        ) : (
          <form onSubmit={onSubmitCode} className="tracera-page-card space-y-5 p-5 md:p-6">
            <div className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(140deg,#ffffff,#f8fbff)] p-5">
              <h3 className="text-base font-semibold text-slate-900">코드로 소유권 인증</h3>
              <p className="mt-1 text-sm text-slate-600">수락코드를 입력하면 디지털 자산 이전을 진행합니다.</p>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-700">수락코드</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="발급받은 수락코드"
                  className="tracera-workflow-field bg-white"
                />
              </div>

            </div>

            <button
              type="submit"
              disabled={!isAuthenticated || submitting || !password.trim()}
              className="tracera-button-primary w-full gap-2 rounded-2xl"
            >
              <Lock size={15} /> {submitting ? '처리 중...' : '코드로 수락 확정'}
            </button>
          </form>
        )}

        {error && (
          <div className="inline-flex w-full items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <CircleAlert size={16} /> {error}
          </div>
        )}

      </div>

      {result && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-xl rounded-[1.9rem] border border-emerald-200 bg-white shadow-[0_36px_90px_-42px_rgba(15,23,42,.45)]">
            <div className="border-b border-emerald-100 bg-[linear-gradient(145deg,#ecfdf5,#ffffff)] px-6 py-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-[0_14px_30px_-22px_rgba(5,150,105,.7)]">
                <CheckCircle2 size={28} />
              </div>
              <div className="mt-4 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Transfer Completed</div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">양도가 성공적으로 완료되었습니다</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  디지털 자산 소유권이 내 계정으로 안전하게 이전되었습니다.
                  내 디지털 자산에서 최신 보유 상태를 바로 확인할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                  <div className="text-[11px] font-medium text-emerald-800/80">Passport ID</div>
                  <div className="mt-1 break-all text-sm font-semibold text-slate-900">{result.passportId || '-'}</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                  <div className="text-[11px] font-medium text-emerald-800/80">상태</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{result.status || '-'}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-800">처리 시각</div>
                <div className="mt-1">{result.completedAt ? new Date(result.completedAt).toLocaleString() : '-'}</div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCompletionModal}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  닫기
                </button>
                <Link
                  to="/mypage?tab=assets"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  내 디지털 자산 보기
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <QRScannerModal
        isOpen={scannerOpen}
        onClose={closeScanner}
        onScanSuccess={handleQrScanSuccess}
        title="소유권 이전 QR 스캐너"
        description="직원이 제시한 이전 QR을 인식하면 소유권 인증이 자동으로 이어집니다."
        tip="Safari를 포함한 모바일 브라우저에서도 같은 흐름으로 사용할 수 있습니다. 카메라가 어려우면 이미지 업로드로도 인식할 수 있습니다."
        uploadLabel="이전 QR 이미지로 스캔하기"
        accent="service"
      />
    </div>
  );
};

export default TransferReceiveView;
