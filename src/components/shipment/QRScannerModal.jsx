import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Upload, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

const QRScannerModal = ({
    isOpen,
    onClose,
    onScanSuccess,
    title = 'QR 코드 스캔',
    description = '카메라로 QR 코드를 인식하면 다음 단계로 바로 연결됩니다.',
    tip = 'QR이 인식되면 현재 흐름에 맞는 화면으로 자동 이동합니다.',
    uploadLabel = '이미지 파일로 스캔하기',
    accent = 'brand'
}) => {
    const [scanError, setScanError] = useState(null);
    const [scannerActive, setScannerActive] = useState(false);
    const scannerRef = useRef(null);
    const html5QrCodeRef = useRef(null);
    const fileInputRef = useRef(null);
    const isStartingRef = useRef(false);

    const isServiceAccent = accent === 'service';
    const accentColor = isServiceAccent ? '#C27A2C' : '#2856D8';
    const accentGlow = isServiceAccent ? 'bg-amber-200/30' : 'bg-blue-200/30';
    const accentHeader = isServiceAccent
        ? 'bg-[linear-gradient(180deg,#fffdf8,#ffffff)]'
        : 'bg-[linear-gradient(180deg,#f8fbff,#ffffff)]';
    const accentIcon = isServiceAccent
        ? 'bg-[linear-gradient(135deg,#C27A2C,#E5B15C)] shadow-[0_20px_40px_-24px_rgba(194,122,44,.35)]'
        : 'bg-[linear-gradient(135deg,#2856D8,#6F95FF)] shadow-[0_20px_40px_-24px_rgba(40,86,216,.35)]';
    const accentBadge = isServiceAccent
        ? 'border-amber-100 bg-amber-50 text-amber-700'
        : 'border-blue-100 bg-blue-50 text-blue-700';
    const accentButton = isServiceAccent
        ? 'border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100'
        : 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isSafari = /Safari/i.test(userAgent) && !/Chrome|CriOS|EdgiOS|FxiOS|Android/i.test(userAgent);

    useEffect(() => {
        if (isOpen) {
            void startScanner();
        } else {
            void stopScanner();
        }

        return () => {
            void stopScanner();
        };
    }, [isOpen]);

    const startWithConfig = async (html5QrCode, cameraConfig, config) => {
        await html5QrCode.start(
            cameraConfig,
            config,
            (decodedText) => {
                handleSuccess(decodedText);
            },
            () => {
                // Ignore noisy scan errors from the library while camera is running.
            }
        );
    };

    const requestCameraPermission = async () => {
        if (!navigator?.mediaDevices?.getUserMedia) {
            throw new Error('camera_unsupported');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
        });
        stream.getTracks().forEach((track) => track.stop());
    };

    const startScanner = async () => {
        if (isStartingRef.current) return;
        isStartingRef.current = true;
        setScanError(null);
        try {
            await stopScanner();
            await requestCameraPermission();

            const html5QrCode = new Html5Qrcode("qr-reader", {
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
            });
            html5QrCodeRef.current = html5QrCode;

            const baseConfig = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };
            const safariConfig = {
                fps: 8,
                disableFlip: false,
            };
            const config = isSafari ? safariConfig : baseConfig;

            const cameras = await Html5Qrcode.getCameras().catch(() => []);
            const rearCamera = cameras.find((camera) =>
                /back|rear|environment/gi.test(`${camera.label || ''}`)
            );
            const cameraCandidates = [
                rearCamera?.id || null,
                cameras[0]?.id || null,
                { facingMode: { exact: "environment" } },
                { facingMode: { ideal: "environment" } },
                { facingMode: "environment" },
                { facingMode: "user" },
            ].filter(Boolean);

            let lastError = null;
            for (const cameraCandidate of cameraCandidates) {
                try {
                    await startWithConfig(html5QrCode, cameraCandidate, config);
                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;
                }
            }

            if (lastError) {
                throw lastError;
            }

            setScannerActive(true);
        } catch (err) {
            console.error("Error starting scanner:", err);
            if (`${err?.message || ''}`.includes('camera_unsupported')) {
                setScanError("이 브라우저에서는 카메라 접근을 지원하지 않습니다. 이미지 업로드 방식으로 스캔해 주세요.");
            } else if (isSafari) {
                setScanError("Safari에서 카메라 시작에 실패했습니다. 주소창 왼쪽의 카메라 권한을 허용한 뒤 다시 시도해 주세요.");
            } else {
                setScanError("카메라를 시작할 수 없습니다. 권한을 확인한 뒤 다시 시도해 주세요.");
            }
            setScannerActive(false);
        } finally {
            isStartingRef.current = false;
        }
    };

    const stopScanner = async () => {
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
                await html5QrCodeRef.current.clear();
            } catch (err) {
                console.error("Error stopping scanner:", err);
            } finally {
                html5QrCodeRef.current = null;
            }
        }
        setScannerActive(false);
    };

    const handleSuccess = (decodedText) => {
        stopScanner();
        onScanSuccess(decodedText);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setScanError(null);
        try {
            const html5QrCode = new Html5Qrcode("qr-reader-hidden");
            const decodedText = await html5QrCode.scanFile(file, true);
            handleSuccess(decodedText);
        } catch (err) {
            console.error("Error scanning file:", err);
            setScanError("QR 코드를 인식할 수 없습니다. 다른 이미지를 시도해 주세요.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_40px_100px_-36px_rgba(15,23,42,.28)] animate-in fade-in duration-300">
                <div className={`pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full blur-3xl ${accentGlow}`} />
                <div className="pointer-events-none absolute bottom-0 left-0 h-52 w-52 rounded-full bg-slate-200/40 blur-3xl" />

                <div className={`relative border-b border-slate-100 px-6 py-5 md:px-7 ${accentHeader}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`rounded-2xl p-3 text-white ${accentIcon}`}>
                                <Camera size={20} />
                            </div>
                            <div>
                                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.16em] ${accentBadge}`}>
                                    <Sparkles size={12} />
                                    LIVE SCANNER
                                </div>
                                <h2 className="mt-3 text-xl font-bold leading-none text-slate-950">{title}</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="relative grid gap-5 p-6 md:grid-cols-[minmax(0,1fr)_280px] md:p-7">
                    <div className="relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-slate-900 shadow-[0_24px_80px_-40px_rgba(15,23,42,.28)]">
                        <div id="qr-reader" className="aspect-square w-full md:aspect-auto md:min-h-[420px]" />

                        {!scannerActive && !scanError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/76 text-white">
                                <RefreshCw className="mb-3 animate-spin opacity-60" size={32} />
                                <span className="text-sm font-medium opacity-90">카메라 준비 중...</span>
                            </div>
                        )}

                        {scanError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50/95 p-6 text-center">
                                <AlertCircle size={40} className="mb-3 text-rose-500" />
                                <p className="mb-4 text-sm font-bold text-rose-900">{scanError}</p>
                                <button
                                    onClick={() => void startScanner()}
                                    className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                                >
                                    다시 시도
                                </button>
                            </div>
                        )}

                        {scannerActive && (
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,.1),rgba(15,23,42,.28))]" />
                                <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/20 bg-white/[0.04] shadow-[0_0_0_999px_rgba(15,23,42,.18)]">
                                    <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-[1.5rem] border-l-4 border-t-4" style={{ borderColor: accentColor }} />
                                    <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-[1.5rem] border-r-4 border-t-4" style={{ borderColor: accentColor }} />
                                    <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[1.5rem] border-b-4 border-l-4" style={{ borderColor: accentColor }} />
                                    <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-[1.5rem] border-b-4 border-r-4" style={{ borderColor: accentColor }} />
                                    <span className="absolute left-5 right-5 top-1/2 h-px -translate-y-1/2 shadow-[0_0_18px_rgba(15,23,42,.2)]" style={{ backgroundColor: `${accentColor}cc` }} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#fffdf9,#ffffff)] p-5 text-slate-900">
                            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${accentBadge}`}>
                                <Sparkles size={13} />
                                실시간 인식
                            </div>
                            <h3 className="mt-4 text-lg font-semibold">프레임 안에 QR을 맞춰주세요</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                조명이 어두우면 밝은 곳으로 이동하거나, 이미지 파일 업로드 방식을 사용해도 됩니다.
                            </p>
                        </div>

                        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-sm text-slate-600">
                            <p className="leading-6">{tip}</p>
                        </div>

                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${accentButton}`}
                        >
                            <Upload size={18} />
                            {uploadLabel}
                        </button>
                    </div>

                    <div id="qr-reader-hidden" className="hidden" />
                </div>
            </div>
        </div>
    );
};

export default QRScannerModal;
