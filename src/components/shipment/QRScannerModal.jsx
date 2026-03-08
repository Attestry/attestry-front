import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Upload, AlertCircle, RefreshCw } from 'lucide-react';

const QRScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
    const [scanError, setScanError] = useState(null);
    const [scannerActive, setScannerActive] = useState(false);
    const scannerRef = useRef(null);
    const html5QrCodeRef = useRef(null);
    const fileInputRef = useRef(null);

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
            const html5QrCode = new Html5Qrcode("qr-reader", {
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
                    // Ignored to avoid noise, but could be logged if needed
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                            <Camera size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 leading-none">QR 스캔 출고</h2>
                            <p className="text-xs text-gray-500 mt-1.5 font-medium">제품의 QR 코드를 스캔하여 즉시 출고합니다.</p>
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
                        <div id="qr-reader" className="w-full h-full" />

                        {/* Overlay elements for better UX */}
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
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-indigo-400 rounded-2xl animate-pulse shadow-[0_0_20px_rgba(129,140,248,0.5)]" />
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
                            <Upload size={18} className="text-indigo-500 group-hover:-translate-y-0.5 transition-transform" />
                            이미지 파일로 스캔하기
                        </button>
                    </div>

                    <div id="qr-reader-hidden" className="hidden" />
                </div>

                {/* Footer Tips */}
                <div className="px-8 pb-8">
                    <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
                        <div className="flex gap-3 text-xs text-indigo-700 leading-relaxed font-medium">
                            <span className="shrink-0 bg-indigo-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">!</span>
                            스캔이 완료되면 자동으로 제품 정보를 확인하여 출고 창이 열립니다.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QRScannerModal;
