import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Sparkles, Upload, CircleAlert } from 'lucide-react';

/**
 * ModernScanner Component
 * Reusable QR scanner with the "Digital Asset Transfer" look and feel.
 * Uses html5-qrcode for robust cross-browser scanning and supports file uploads.
 */
const ModernScanner = ({ isOpen, onClose, onScan, title = "QR 카메라 스캐너", status = "" }) => {
    const [cameraOn, setCameraOn] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [scannerStatus, setScannerStatus] = useState('');
    const [isScanningFile, setIsScanningFile] = useState(false);

    const videoRegionId = "modern-qr-reader";
    const fileInputRef = useRef(null);
    const html5QrCodeRef = useRef(null);

    const playScannerSuccessFeedback = useCallback(() => {
        try {
            if (navigator.vibrate) {
                navigator.vibrate([90, 40, 120]);
            }
        } catch (e) { }

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
                ctx.close().catch(() => { });
            }, 350);
        } catch (e) { }
    }, []);

    const stopCamera = useCallback(async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            try {
                await html5QrCodeRef.current.stop();
                await html5QrCodeRef.current.clear();
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
        setCameraOn(false);
    }, []);

    const startScanner = useCallback(async () => {
        setCameraError('');
        setScannerStatus('');

        try {
            await stopCamera();

            const html5QrCode = new Html5Qrcode(videoRegionId);
            html5QrCodeRef.current = html5QrCode;

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    handleSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignored
                }
            );

            setCameraOn(true);
            setScannerStatus('QR 코드를 화면 중앙에 맞춰주세요.');
        } catch (e) {
            setCameraError('카메라를 열 수 없습니다. 브라우저 권한을 확인해주세요.');
            setCameraOn(false);
        }
    }, [stopCamera]);

    const handleSuccess = (decodedText) => {
        playScannerSuccessFeedback();
        stopCamera();
        onScan(decodedText);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setCameraError('');
        setIsScanningFile(true);
        try {
            const html5QrCode = new Html5Qrcode("modern-qr-reader-hidden");
            const decodedText = await html5QrCode.scanFile(file, true);
            handleSuccess(decodedText);
        } catch (err) {
            setCameraError("QR 코드를 인식할 수 없습니다. 다른 이미지를 시도해 주세요.");
        } finally {
            setIsScanningFile(false);
            if (e.target) e.target.value = '';
        }
    };

    useEffect(() => {
        if (isOpen) {
            startScanner();
        } else {
            stopCamera();
        }
        return () => {
            stopCamera();
        };
    }, [isOpen, startScanner, stopCamera]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300 flex items-center justify-center">
            <div className="mx-auto flex h-full w-full max-w-lg flex-col px-4 py-8 md:px-6">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-500/20 rounded-xl border border-cyan-500/30 text-cyan-400">
                            <Camera size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-500 font-bold">Live AI Scanner</p>
                            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scanner Area */}
                <div className="relative aspect-square w-full overflow-hidden rounded-[2.5rem] border border-white/10 bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <div id={videoRegionId} className="h-full w-full" />

                    {/* Scanning Overlay */}
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <div className="relative h-64 w-64">
                            {/* Corner Accents */}
                            <span className="absolute left-0 top-0 h-12 w-12 border-l-4 border-t-4 border-cyan-400 rounded-tl-3xl shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                            <span className="absolute right-0 top-0 h-12 w-12 border-r-4 border-t-4 border-cyan-400 rounded-tr-3xl shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                            <span className="absolute bottom-0 left-0 h-12 w-12 border-b-4 border-l-4 border-cyan-400 rounded-bl-3xl shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                            <span className="absolute bottom-0 right-0 h-12 w-12 border-b-4 border-r-4 border-cyan-400 rounded-br-3xl shadow-[0_0_15px_rgba(34,211,238,0.5)]" />

                            {/* Inner Pulsing area */}
                            <div className="absolute inset-0 border border-white/5 bg-white/5 rounded-2xl animate-pulse" />
                        </div>

                        {/* Scanning Line Animation */}
                        {cameraOn && (
                            <div className="absolute w-64 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent blur-[2px] animate-scan-line shadow-[0_0_10px_rgba(34,211,238,0.8)]" style={{ top: 'calc(50% - 128px)' }} />
                        )}
                    </div>

                    {!cameraOn && !cameraError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
                            <p className="text-cyan-200/70 text-sm font-medium">카메라 준비 중...</p>
                        </div>
                    )}
                </div>

                {/* Status & Actions */}
                <div className="mt-8 flex flex-col items-center gap-6">
                    {(status || scannerStatus) && !cameraError && (
                        <p className="text-cyan-200/90 text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/5 border border-cyan-500/10">
                            <Sparkles size={14} className="animate-pulse" />
                            {status || scannerStatus}
                        </p>
                    )}

                    {cameraError && (
                        <div className="w-full flex items-center gap-3 text-red-400 bg-red-400/10 border border-red-400/20 rounded-2xl p-4 animate-in slide-in-from-top-2">
                            <CircleAlert size={20} className="shrink-0" />
                            <p className="text-sm font-medium leading-relaxed">{cameraError}</p>
                        </div>
                    )}

                    <div className="w-full grid grid-cols-1 gap-4">
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isScanningFile}
                            className="group flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isScanningFile ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Upload size={20} className="text-cyan-400 group-hover:-translate-y-1 transition-transform" />
                                    <span>이미지 파일로 스캔하기</span>
                                </>
                            )}
                        </button>
                    </div>

                    <p className="text-white/30 text-[11px] font-medium text-center uppercase tracking-widest">
                        Powered by Advanced Neural Scanning
                    </p>
                </div>
            </div>

            <div id="modern-qr-reader-hidden" className="hidden" />

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scan-line {
                    0% { transform: translateY(0); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(256px); opacity: 0; }
                }
                .animate-scan-line {
                    animation: scan-line 2.5s ease-in-out infinite;
                }
            `}} />
        </div>
    );
};

export default ModernScanner;
