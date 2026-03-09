import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Upload, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * WhiteScannerModal Component
 * A clean, white-toned QR scanner modal that supports multiple color variants.
 * Based on the original high-quality design used in shipment management.
 */
const WhiteScannerModal = ({
    isOpen,
    onClose,
    onScan,
    variant = 'default',
    title = "QR 스캐너",
    description = "QR 코드를 스캔해 주세요.",
    status = "스캔이 완료되면 자동으로 정보를 확인합니다."
}) => {
    const [scanError, setScanError] = useState(null);
    const [scannerActive, setScannerActive] = useState(false);
    const html5QrCodeRef = useRef(null);
    const fileInputRef = useRef(null);

    // Variant-based styling
    const themes = {
        brand: {
            primary: 'indigo',
            headerGradient: 'from-indigo-50',
            iconBg: 'bg-indigo-600',
            iconShadow: 'shadow-indigo-200',
            scanFrame: 'border-indigo-400',
            scanFrameShadow: 'rgba(129,140,248,0.5)',
            tipBg: 'bg-indigo-50/50',
            tipBorder: 'border-indigo-100/50',
            tipText: 'text-indigo-700',
            tipIconBg: 'bg-indigo-600',
            uploadIcon: 'text-indigo-500'
        },
        service: {
            primary: 'amber',
            headerGradient: 'from-amber-50',
            iconBg: 'bg-amber-500',
            iconShadow: 'shadow-amber-200',
            scanFrame: 'border-amber-400',
            scanFrameShadow: 'rgba(251,191,36,0.5)',
            tipBg: 'bg-amber-50/50',
            tipBorder: 'border-amber-100/50',
            tipText: 'text-amber-700',
            tipIconBg: 'bg-amber-500',
            uploadIcon: 'text-amber-500'
        },
        default: {
            primary: 'cyan',
            headerGradient: 'from-cyan-50',
            iconBg: 'bg-cyan-500',
            iconShadow: 'shadow-cyan-200',
            scanFrame: 'border-cyan-400',
            scanFrameShadow: 'rgba(34,211,238,0.5)',
            tipBg: 'bg-cyan-50/50',
            tipBorder: 'border-cyan-100/50',
            tipText: 'text-cyan-700',
            tipIconBg: 'bg-cyan-500',
            uploadIcon: 'text-cyan-500'
        }
    };

    const theme = themes[variant] || themes.default;

    useEffect(() => {
        if (isOpen) {
            startScanner();
        } else {
            stopScanner();
        }

        return () => {
            stopScanner();
        };
    }, [isOpen]);

    const startScanner = async () => {
        setScanError(null);
        try {
            const html5QrCode = new Html5Qrcode("white-qr-reader", {
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
            });
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
            setScannerActive(true);
        } catch (err) {
            console.error("Error starting scanner:", err);
            setScanError("카메라를 시작할 수 없습니다. 권한 구성을 확인해 주세요.");
            setScannerActive(false);
        }
    };

    const stopScanner = async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            try {
                await html5QrCodeRef.current.stop();
                await html5QrCodeRef.current.clear();
            } catch (err) {
                console.error("Error stopping scanner:", err);
            }
        }
        setScannerActive(false);
    };

    const handleSuccess = (decodedText) => {
        stopScanner();
        onScan(decodedText);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setScanError(null);
        try {
            const html5QrCode = new Html5Qrcode("white-qr-reader-hidden");
            const decodedText = await html5QrCode.scanFile(file, true);
            handleSuccess(decodedText);
        } catch (err) {
            console.error("Error scanning file:", err);
            setScanError("QR 코드를 인식할 수 없습니다. 다른 이미지를 시도해 주세요.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className={`flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r ${theme.headerGradient} to-white`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 ${theme.iconBg} rounded-xl text-white shadow-lg ${theme.iconShadow}`}>
                            <Camera size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 leading-none">{title}</h2>
                            <p className="text-xs text-gray-500 mt-1.5 font-medium">{description}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-all p-2 hover:bg-gray-100 rounded-full cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    <div className="relative aspect-square w-full max-w-[320px] mx-auto bg-gray-900 rounded-2xl overflow-hidden shadow-inner border-4 border-gray-800">
                        <div id="white-qr-reader" className="w-full h-full" />

                        {!scannerActive && !scanError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900/80">
                                <RefreshCw className="animate-spin mb-3 opacity-50" size={32} />
                                <span className="text-sm font-medium opacity-80">카메라 준비 중...</span>
                            </div>
                        )}

                        {scanError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-red-50/95">
                                <AlertCircle size={40} className="text-red-500 mb-3" />
                                <p className="text-sm font-bold text-red-900 mb-4">{scanError}</p>
                                <button
                                    onClick={startScanner}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
                                >
                                    다시 시도
                                </button>
                            </div>
                        )}

                        {/* Scan Area Frame Overlay */}
                        {scannerActive && (
                            <div className="absolute inset-0 pointer-events-none">
                                <div
                                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 ${theme.scanFrame} rounded-2xl animate-pulse`}
                                    style={{ boxShadow: `0 0 20px ${theme.scanFrameShadow}` }}
                                />
                                <div className="absolute top-0 left-0 right-0 bottom-0 bg-black/20" />
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex flex-col gap-3">
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gray-50 text-gray-700 border border-gray-200 rounded-2xl text-sm font-bold hover:bg-gray-100 hover:border-gray-300 transition-all group"
                        >
                            <Upload size={18} className={`${theme.uploadIcon} group-hover:-translate-y-0.5 transition-transform`} />
                            이미지 파일로 스캔하기
                        </button>
                    </div>

                    <div id="white-qr-reader-hidden" className="hidden" />
                </div>

                {/* Footer Tips */}
                <div className="px-8 pb-8">
                    <div className={`${theme.tipBg} rounded-2xl p-4 border ${theme.tipBorder}`}>
                        <div className={`flex gap-3 text-xs ${theme.tipText} leading-relaxed font-medium`}>
                            <span className={`shrink-0 ${theme.tipIconBg} text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]`}>!</span>
                            {status}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhiteScannerModal;
