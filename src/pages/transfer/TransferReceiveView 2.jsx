import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Camera,
  Keyboard,
  ScanLine,
  ShieldCheck,
  CheckCircle2,
  CircleAlert,
  Sparkles,
  Lock,
  X,
} from 'lucide-react';
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
    return text?.trim() ? `${prefix} ${text.slice(0, 180)}` : `${prefix} 요청 처리에 실패했습니다.`;
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

const parseScanPayload = (rawValue) => {
  const value = String(rawValue || '').trim();
  if (!value) return { qrNonce: '', transferId: '' };

  try {
    const url = new URL(value);
    const qrNonce = url.searchParams.get('qrNonce') || url.searchParams.get('nonce') || '';
    const transferId = url.searchParams.get('transferId') || '';
    if (qrNonce || transferId) return { qrNonce, transferId };

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 't') {
      const pathTransferId = parts[1] || '';
      const pathQrNonce = parts[2] || '';
      if (pathTransferId || pathQrNonce) return { qrNonce: pathQrNonce, transferId: pathTransferId };
    }
  } catch {
    // non-URL
  }

  try {
    const parsed = JSON.parse(value);
    const qrNonce = parsed?.qrNonce || parsed?.nonce || '';
    const transferId = parsed?.transferId || '';
    if (qrNonce || transferId) return { qrNonce, transferId };
  } catch {
    // non-JSON
  }

  return { qrNonce: value, transferId: '' };
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
  const [cameraOn, setCameraOn] = React.useState(false);
  const [cameraError, setCameraError] = React.useState('');
  const [scannerStatus, setScannerStatus] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [result, setResult] = React.useState(null);

  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const scanTimerRef = React.useRef(null);
  const autoSubmittingRef = React.useRef(false);
  const lastRawValueRef = React.useRef('');
  const autoAcceptFromQueryTriedRef = React.useRef(false);

  const barcodeDetectorSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

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

  const stopCamera = React.useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
  }, []);

  const closeScanner = React.useCallback(() => {
    setScannerOpen(false);
    stopCamera();
  }, [stopCamera]);

  const acceptTransfer = React.useCallback(async ({ acceptMethod, transferIdValue, nonceValue, passwordValue, auto = false }) => {
    setError('');
    setSuccess('');
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
      setSuccess('디지털 자산을 안전하게 이전 받았습니다.');
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

  const startScanner = React.useCallback(async () => {
    setCameraError('');
    setScannerStatus('');
    setError('');

    if (!barcodeDetectorSupported) {
      setCameraError('현재 브라우저는 실시간 QR 스캔을 지원하지 않습니다. 코드 입력 모드를 이용해주세요.');
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('이 환경에서는 카메라 접근을 지원하지 않습니다.');
      return;
    }

    try {
      stopCamera();
      setScannerOpen(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      setCameraOn(true);
      setScannerStatus('직원이 제시한 QR 코드를 화면 중앙에 맞춰주세요.');

      scanTimerRef.current = setInterval(async () => {
        if (!videoRef.current || autoSubmittingRef.current || submitting) return;

        try {
          const barcodes = await detector.detect(videoRef.current);
          const rawValue = barcodes?.[0]?.rawValue?.trim();
          if (!rawValue) return;
          if (rawValue === lastRawValueRef.current) return;
          lastRawValueRef.current = rawValue;

          const parsed = parseScanPayload(rawValue);
          const detectedTransferId = parsed.transferId || transferId;
          const detectedNonce = parsed.qrNonce;

          if (!detectedTransferId || !detectedNonce) {
            setScannerStatus('유효한 이전 QR이 아닙니다. 다시 스캔해주세요.');
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
        } catch {
          // keep scanning
        }
      }, 650);
    } catch (e) {
      setCameraError(e?.message || '카메라를 열 수 없습니다. 브라우저 권한을 확인해주세요.');
      stopCamera();
      setScannerOpen(true);
    }
  }, [acceptTransfer, barcodeDetectorSupported, stopCamera, submitting, transferId]);

  React.useEffect(() => {
    if (mode !== 'QR') {
      closeScanner();
    }
  }, [mode, closeScanner]);

  React.useEffect(() => () => closeScanner(), [closeScanner]);

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
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[radial-gradient(circle_at_10%_8%,rgba(15,23,42,.1),transparent_30%),radial-gradient(circle_at_90%_0,rgba(37,99,235,.16),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6 md:py-12 space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-slate-800/10 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#1d4ed8_100%)] p-7 md:p-9 text-white shadow-[0_30px_80px_-30px_rgba(15,23,42,.8)]">
          <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-white/10 blur-xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-16 h-44 w-44 rounded-full bg-blue-300/20 blur-xl" />

          <div className="relative space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
              <ShieldCheck size={14} /> Secure Transfer Gateway
            </div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">
              안내받은 방식에 따라 소유권을 인증하고,
              <br className="hidden md:block" />
              본인 계정의 디지털 자산 지갑에 안전하게 이전하세요.
            </h1>
          </div>
        </header>

        {!isAuthenticated && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            로그인 후 이용 가능합니다. <Link className="font-semibold underline" to="/login">로그인하기</Link>
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 md:p-6 shadow-[0_24px_50px_-36px_rgba(15,23,42,.55)] backdrop-blur-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setMode('QR')}
              className={`group rounded-2xl border p-4 text-left transition ${mode === 'QR' ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-[0_10px_28px_-20px_rgba(37,99,235,.9)]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-2 text-base font-semibold"><Camera size={18} /> 📷 QR 스캔</div>
              <p className="mt-1 text-xs opacity-80">직원이 제시한 QR 코드를 카메라로 스캔해주세요.</p>
            </button>

            <button
              type="button"
              onClick={() => setMode('CODE')}
              className={`group rounded-2xl border p-4 text-left transition ${mode === 'CODE' ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-[0_10px_28px_-20px_rgba(37,99,235,.9)]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-2 text-base font-semibold"><Keyboard size={18} /> ✍️ 코드 입력</div>
              <p className="mt-1 text-xs opacity-80">이전 코드(비밀번호)로 소유권 인증을 진행합니다.</p>
            </button>
          </div>
        </section>

        {mode === 'QR' ? (
          <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_24px_50px_-36px_rgba(15,23,42,.55)] backdrop-blur-sm">
            <div className="relative mx-auto max-w-xl">
              <div className="absolute inset-0 -z-10 rounded-3xl bg-[radial-gradient(circle_at_50%_0,rgba(29,78,216,.22),transparent_62%)]" />
              <button
                type="button"
                onClick={startScanner}
                disabled={!isAuthenticated || submitting}
                className="group flex w-full flex-col items-center justify-center gap-3 rounded-3xl border border-blue-200 bg-[linear-gradient(160deg,#ffffff_0%,#eef4ff_70%,#e0ebff_100%)] px-8 py-12 text-center shadow-[0_22px_48px_-30px_rgba(29,78,216,.85)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_54px_-28px_rgba(29,78,216,.95)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_100%)] text-white shadow-lg">
                  <ScanLine size={30} />
                </span>
                <span className="text-xl font-bold tracking-tight text-slate-900">여기를 눌러 스캐너 켜기</span>
                <span className="text-sm text-slate-600">카메라가 열리면 QR을 중앙 프레임에 맞춰주세요</span>
              </button>
            </div>

            {scannerStatus && <p className="mt-4 text-center text-sm text-blue-700">{scannerStatus}</p>}
            {cameraError && <p className="mt-3 text-center text-sm text-red-700">{cameraError}</p>}
          </section>
        ) : (
          <form onSubmit={onSubmitCode} className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_24px_50px_-36px_rgba(15,23,42,.55)] backdrop-blur-sm space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(140deg,#ffffff,#f8fbff)] p-5">
              <h3 className="text-base font-semibold text-slate-900">코드로 소유권 인증</h3>
              <p className="mt-1 text-sm text-slate-600">수락코드를 입력하면 디지털 자산 이전을 진행합니다.</p>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-700">수락코드</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="발급받은 수락코드"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

            </div>

            <button
              type="submit"
              disabled={!isAuthenticated || submitting || !password.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0f172a_0%,#1f2937_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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

        {success && (
          <div className="inline-flex w-full items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        {result && (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5 md:p-6 shadow-[0_18px_40px_-34px_rgba(5,150,105,.9)]">
            <h2 className="mb-3 text-lg font-semibold text-emerald-900">이전 완료</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm text-emerald-900 md:grid-cols-2">
              <div><dt className="font-medium">Transfer ID</dt><dd>{result.transferId || '-'}</dd></div>
              <div><dt className="font-medium">Passport ID</dt><dd>{result.passportId || '-'}</dd></div>
              <div><dt className="font-medium">상태</dt><dd>{result.status || '-'}</dd></div>
              <div><dt className="font-medium">새 소유자</dt><dd>{result.toOwnerId || '-'}</dd></div>
            </dl>
            <div className="mt-4">
              <Link
                to="/mypage?tab=assets"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                내 디지털 자산 보기
              </Link>
            </div>
          </section>
        )}
      </div>

      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-4 py-5 md:px-6">
            <div className="mb-3 flex items-center justify-between text-white">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-300">Live Scanner</p>
                <h2 className="text-lg font-semibold">QR 카메라 스캐너</h2>
              </div>
              <button
                type="button"
                onClick={closeScanner}
                className="inline-flex items-center gap-1 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-sm"
              >
                <X size={14} /> 닫기
              </button>
            </div>

            <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/20 bg-black">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />

              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="h-56 w-56 rounded-2xl border border-white/35 bg-white/5" />
                <div className="absolute h-56 w-56">
                  <span className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-cyan-300" />
                  <span className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-cyan-300" />
                  <span className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-cyan-300" />
                  <span className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-cyan-300" />
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-sm">
              {cameraOn && (
                <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                  <Sparkles size={13} /> 카메라가 실행 중입니다.
                </p>
              )}
              {scannerStatus && <p className="text-blue-200">{scannerStatus}</p>}
              {cameraError && <p className="text-red-300">{cameraError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferReceiveView;
