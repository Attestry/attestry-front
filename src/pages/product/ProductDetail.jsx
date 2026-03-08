import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Package, ArrowLeft, Calendar, Hash, Factory, Database,
    ShieldCheck, AlertTriangle, FileText, Download, User,
    Clock, CheckCircle2, ChevronRight, Loader2, QrCode, Printer
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import useAuthStore from '../../store/useAuthStore';

// Role-based utility to fetch with Auth Token
const fetchWithAuth = async (url, options = {}) => {
    const token = useAuthStore.getState().accessToken;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
    });
    if (!response.ok) {
        let errorMsg = `API Error: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
        } catch (e) { }
        throw new Error(errorMsg);
    }
    return response.status !== 204 ? response.json() : null;
};

const ProductDetail = () => {
    const { passportId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchProductDetail = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchWithAuth(`/products/tenant/passports/${passportId}`);
            setProduct(data);
        } catch (err) {
            console.error("Failed to fetch product detail:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (passportId) {
            fetchProductDetail();
        }
    }, [passportId]);

    const handleBack = () => {
        navigate(-1);
    };

    const downloadQRCode = () => {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas) return;
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `qr-${product.serialNumber}.png`;
        link.href = url;
        link.click();
    };

    const handlePrint = () => {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas) {
            alert("QR 코드를 생성하는 중입니다. 잠시 후 다시 시도해주세요.");
            return;
        }

        const dataUrl = canvas.toDataURL('image/png');
        const printWindow = window.open('', '_blank', 'width=800,height=800');

        if (!printWindow) {
            alert("팝업 차단을 해제해주세요.");
            return;
        }

        const windowContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Print QR - ${product.serialNumber}</title>
                    <style>
                        body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                        .label-container { border: 4px solid black; padding: 50px; border-radius: 50px; text-align: center; width: fit-content; background: white; }
                        .model-name { font-size: 32px; font-weight: 900; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: -1px; }
                        .serial-no { font-size: 18px; font-weight: bold; margin: 0 0 30px 0; color: #444; }
                        .qr-image { width: 350px; height: 350px; margin-bottom: 30px; display: block; margin-left: auto; margin-right: auto; }
                        .footer { border-top: 3px solid black; padding-top: 25px; margin-top: 10px; }
                        .footer-text { font-size: 14px; font-weight: 900; margin: 0; text-transform: uppercase; }
                        .public-code { font-size: 12px; font-family: monospace; font-weight: bold; color: #888; margin: 6px 0 0 0; letter-spacing: 2px; }
                        @page { size: auto; margin: 0; }
                    </style>
                </head>
                <body>
                    <div class="label-container">
                        <h1 class="model-name">${product.modelName}</h1>
                        <p class="serial-no">S/N: ${product.serialNumber}</p>
                        <img src="${dataUrl}" class="qr-image" />
                        <div class="footer">
                            <p class="footer-text">Attestry Original Authenticated Product</p>
                            <p class="public-code">${product.qrPublicCode}</p>
                        </div>
                    </div>
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(windowContent);
        printWindow.document.close();
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
                <Loader2 size={40} className="animate-spin mb-4 text-indigo-500" />
                <p className="font-medium">제품 정보를 불러오는 중입니다...</p>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-bold mb-6 transition-colors cursor-pointer"
                >
                    <ArrowLeft size={20} />
                    뒤로 가기
                </button>
                <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
                    <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-red-900 mb-2">오류가 발생했습니다</h2>
                    <p className="text-red-600 font-medium">{error || "제품을 찾을 수 없습니다."}</p>
                </div>
            </div>
        );
    }

    const { shipment } = product;

    return (
        <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
            {/* Navigation & Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-gray-400 hover:text-indigo-600 font-bold mb-4 transition-colors cursor-pointer group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        목록으로 돌아가기
                    </button>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                        {product.modelName}
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border ${product.assetState === 'ACTIVE'
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                            {product.assetState}
                        </span>
                    </h1>
                    <p className="text-gray-500 mt-1 font-mono text-sm uppercase tracking-wider">
                        SN: {product.serialNumber}
                    </p>
                </div>

                <div className="flex gap-2">
                    <a
                        href={product.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 transition-colors"
                    >
                        <ShieldCheck size={16} className="text-green-500" />
                        공개 원장 확인
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Product Specs */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Basic Info Card */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                            <Database size={18} className="text-indigo-500" />
                            <h2 className="font-bold text-gray-900">제품 상세 사양</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                            <InfoItem icon={<Hash size={16} />} label="Passport ID" value={product.passportId} mono isCopyable />
                            <InfoItem icon={<Database size={16} />} label="Asset ID" value={product.assetId} mono />
                            <InfoItem icon={<Calendar size={16} />} label="제조 일시" value={new Date(product.manufacturedAt).toLocaleString()} />
                            <InfoItem icon={<Clock size={16} />} label="발행 일시" value={new Date(product.createdAt).toLocaleString()} />
                            <InfoItem icon={<Factory size={16} />} label="공장 코드" value={product.factoryCode || '-'} />
                            <InfoItem icon={<Package size={16} />} label="생산 배치" value={product.productionBatch || '-'} />
                            <InfoItem icon={<ShieldCheck size={16} />} label="리스크 플래그" value={product.riskFlag} variant={product.riskFlag !== 'NONE' ? 'danger' : 'success'} />
                        </div>
                    </section>

                    {/* Shipment Info Card */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                            <Package size={18} className="text-orange-500" />
                            <h2 className="font-bold text-gray-900">최신 물류 정보 (Shipment)</h2>
                        </div>
                        {shipment ? (
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className={`p-3 rounded-2xl ${shipment.status === 'RELEASED' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-900">
                                            {shipment.status === 'RELEASED' ? '출고 완료' : '반품됨'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(shipment.releasedAt).toLocaleString()} 처리됨
                                        </div>
                                    </div>
                                    <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full text-[10px] font-bold text-gray-500 border border-gray-100">
                                        ROUND {shipment.shipmentRound}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-50 pt-6 mt-2">
                                    <InfoItem icon={<User size={16} />} label="출고 처리자 이메일" value={shipment.releasedByUserEmail} mono />
                                    {shipment.status === 'RETURNED' && (
                                        <InfoItem icon={<User size={16} />} label="반품 처리자 이메일" value={shipment.returnedByUserEmail} mono />
                                    )}
                                </div>

                                {/* Evidence Files Sub-section */}
                                <div className="mt-8 pt-6 border-t border-gray-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <FileText size={16} className="text-blue-500" />
                                        <h3 className="text-sm font-bold text-gray-900">증빙 자료 (Evidence)</h3>
                                    </div>
                                    {shipment.evidenceFiles?.length > 0 ? (
                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {shipment.evidenceFiles.map((file) => (
                                                <li key={file.evidenceId} className="group p-3 border border-gray-50 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white rounded-lg group-hover:bg-white border border-gray-50 transition-colors shadow-sm text-center">
                                                            <FileText size={18} className="text-gray-400 group-hover:text-indigo-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-gray-900 truncate" title={file.originalFileName}>
                                                                {file.originalFileName}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 font-medium">
                                                                {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB • {file.contentType.split('/')[1].toUpperCase()}
                                                            </p>
                                                        </div>
                                                        <a
                                                            href={file.downloadUrl}
                                                            download={file.originalFileName}
                                                            className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                                            title="다운로드"
                                                        >
                                                            <Download size={18} />
                                                        </a>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="py-4 text-center border-2 border-dashed border-gray-50 rounded-xl">
                                            <p className="text-xs text-gray-400 py-4">첨부된 증빙 자료가 없습니다.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Clock size={24} className="text-gray-300" />
                                </div>
                                <p className="text-gray-400 font-medium tracking-tight">아직 출고된 이력이 없습니다.</p>
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                    {/* QR Code Section */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group/qr">
                        <div className="p-3 bg-indigo-50 rounded-2xl mb-4 group-hover/qr:scale-110 transition-transform duration-300">
                            <QrCode size={24} className="text-indigo-600" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mb-4 tracking-tight">제품 인증 QR 코드</h3>

                        <div className="bg-white p-3 rounded-2xl shadow-inner border border-gray-50 mb-6 relative">
                            {/* SVG for screen display */}
                            <QRCodeSVG
                                value={product.publicUrl}
                                size={140}
                                level="H"
                                includeMargin={true}
                            />
                            {/* Canvas for downloading (hidden but accessible via ID) */}
                            <div className="hidden">
                                <QRCodeCanvas
                                    id="qr-canvas"
                                    value={product.publicUrl}
                                    size={1024} // High resolution for download
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>
                        </div>

                        <div className="w-full space-y-3">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Public Verification Code</p>
                                <p className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block">
                                    {product.qrPublicCode}
                                </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={downloadQRCode}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-indigo-200 transition-all cursor-pointer shadow-sm"
                                >
                                    <Download size={14} className="text-indigo-500" />
                                    이미지 저장
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 border border-transparent rounded-lg text-xs font-bold text-white hover:bg-indigo-700 transition-all cursor-pointer shadow-md"
                                >
                                    <Printer size={14} />
                                    QR 인쇄
                                </button>
                            </div>
                        </div>

                        <p className="text-[10px] text-gray-400 mt-6 leading-relaxed">
                            이 QR 코드는 제품의 정품 여부를<br />
                            공개 원장에서 확인하기 위한 코드입니다.
                        </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <CheckCircle2 size={18} />
                            최근 상태 요약
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm border-b border-indigo-500 pb-3">
                                <span className="text-indigo-100">Asset State</span>
                                <span className="font-bold font-mono">{product.assetState}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-indigo-100">Risk Level</span>
                                <span className={`font-bold px-2 py-0.5 rounded ${product.riskFlag === 'NONE' ? 'bg-indigo-500' : 'bg-red-400'}`}>
                                    {product.riskFlag}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InfoItem = ({ icon, label, value, mono = false, isCopyable = false, variant = 'default' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!isCopyable) return;
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const variantStyles = {
        default: 'text-gray-900',
        success: 'text-green-600 font-bold',
        danger: 'text-red-600 font-bold',
    };

    return (
        <div className="space-y-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                {icon}
                {label}
            </div>
            <div
                className={`text-sm truncate flex items-center gap-2 ${mono ? 'font-mono' : 'font-medium'} ${variantStyles[variant]} ${isCopyable ? 'cursor-pointer' : ''}`}
                onClick={handleCopy}
            >
                {value}
                {isCopyable && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 group-hover:text-indigo-600'}`}>
                        {copied ? 'Copied!' : 'Copy'}
                    </span>
                )}
            </div>
        </div>
    );
};

export default ProductDetail;
