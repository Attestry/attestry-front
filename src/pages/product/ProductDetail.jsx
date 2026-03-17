import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Package, ArrowLeft, Calendar, Hash, Factory, Database,
    ShieldCheck, AlertTriangle, FileText, Download, User,
    Clock, CheckCircle2, ChevronRight, Loader2, QrCode, Printer,
    RefreshCw, Send
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import useAuthStore from '../../store/useAuthStore';
import { apiFetchJson } from '../../utils/api';
import { getCurrentMembership, hasEffectiveScope, normalizeApiErrorMessage, toPermissionMessage } from '../../utils/permissionUi';
import ProductManualSendModal from './ProductManualSendModal';
import { getPassportManualRecipient } from './productManualApi';

// Role-based utility to fetch with Auth Token
const fetchWithAuth = async (url, options = {}) => {
    const token = useAuthStore.getState().accessToken;
    return apiFetchJson(url, options, {
        token,
        fallbackMessage: normalizeApiErrorMessage('', undefined, '제품 상세 정보를 불러오지 못했습니다.')
    });
};

const ProductDetail = () => {
    const { passportId } = useParams();
    const navigate = useNavigate();
    const { user, myMemberships } = useAuthStore();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [manualRecipient, setManualRecipient] = useState(null);
    const [manualRecipientLoading, setManualRecipientLoading] = useState(false);

    const fetchProductDetail = useCallback(async () => {
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
    }, [passportId]);

    useEffect(() => {
        if (passportId) {
            void fetchProductDetail();
        }
    }, [passportId, fetchProductDetail]);

    const publicPassportUrl = useMemo(() => {
        if (!passportId) return '';
        return `${window.location.origin}/products/passports/${encodeURIComponent(passportId)}`;
    }, [passportId]);

    const currentMembership = getCurrentMembership(myMemberships, user?.tenantId, 'BRAND');
    const canSendManual = user?.role === 'BRAND' && hasEffectiveScope(currentMembership, 'BRAND_RELEASE');

    const handleBack = () => {
        navigate(-1);
    };

    const handleOpenManualModal = async () => {
        if (!passportId || !user?.tenantId) return;
        if (!canSendManual) {
            alert('현재 계정은 메뉴얼 발송 권한이 없습니다. 해당 권한이 있는 멤버에게 요청해주세요.');
            return;
        }

        setManualRecipientLoading(true);
        try {
            const recipient = await getPassportManualRecipient(user.tenantId, passportId);
            setManualRecipient(recipient);
            if (!recipient.available) {
                alert(recipient.message || '현재 소유주가 없습니다.');
                return;
            }
            setManualModalOpen(true);
        } catch (recipientError) {
            console.error('Failed to load passport manual recipient:', recipientError);
            const message = toPermissionMessage(recipientError, 'BRAND_RELEASE', '메뉴얼 수신 대상을 확인하지 못했습니다.');
            alert(message);
        } finally {
            setManualRecipientLoading(false);
        }
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
                            <p class="footer-text">Proveny Original Authenticated Product</p>
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
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 animate-in fade-in duration-500">
            {/* Navigation & Header */}
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-gray-400 hover:text-indigo-600 font-bold mb-4 transition-colors cursor-pointer group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        목록으로 돌아가기
                    </button>
                    <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:gap-3 sm:text-3xl">
                        <span className="min-w-0 break-words">{product.modelName}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border ${product.assetState === 'ACTIVE'
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                            {product.assetState}
                        </span>
                    </h1>
                    <p className="mt-1 break-all font-mono text-xs uppercase tracking-wider text-gray-500 sm:text-sm">
                        SN: {product.serialNumber}
                    </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {user?.role === 'BRAND' && (
                        <button
                            type="button"
                            onClick={handleOpenManualModal}
                            disabled={manualRecipientLoading}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                            {manualRecipientLoading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Send size={16} />
                            )}
                            메뉴얼 보내기
                        </button>
                    )}
                    <a
                        href={publicPassportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 sm:w-auto"
                    >
                        <ShieldCheck size={16} className="text-green-500" />
                        공개 원장 확인
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
                {/* Left Column: Product Specs */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Basic Info Card */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-gray-50 px-4 py-4 sm:px-6">
                            <Database size={18} className="text-indigo-500" />
                            <h2 className="font-bold text-gray-900">제품 상세 사양</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-4 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-6 sm:p-6">
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
                        <div className="flex items-center gap-2 border-b border-gray-50 px-4 py-4 sm:px-6">
                            <Package size={18} className="text-orange-500" />
                            <h2 className="font-bold text-gray-900">최신 물류 정보 (Shipment)</h2>
                        </div>
                        {shipment ? (
                            <div className="p-4 sm:p-6">
                                <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center">
                                    <div className={`p-3 rounded-2xl ${shipment.status === 'RELEASED' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                                        <Package size={24} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-gray-900">
                                            {shipment.status === 'RELEASED' ? '출고 완료' : '반품됨'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(shipment.releasedAt).toLocaleString()} 처리됨
                                        </div>
                                    </div>
                                    <div className="flex w-fit items-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 px-3 py-1 text-[10px] font-bold text-gray-500 sm:ml-auto">
                                        ROUND {shipment.shipmentRound}
                                    </div>
                                </div>

                                <div className="mt-2 grid grid-cols-1 gap-5 border-t border-gray-50 pt-6 sm:grid-cols-2 sm:gap-6">
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
                                        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {shipment.evidenceFiles.map((file) => (
                                                <li key={file.evidenceId} className="group p-3 border border-gray-50 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all">
                                                    <div className="flex items-start gap-3">
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
                                                            className="ml-auto p-2 text-gray-400 transition-colors hover:text-indigo-600"
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

                    {/* Distribution Info Card */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-gray-50 px-4 py-4 sm:px-6">
                            <RefreshCw size={18} className="text-indigo-500" />
                            <h2 className="font-bold text-gray-900">유통 위임 정보 (Distribution)</h2>
                        </div>
                        {product.distribution ? (
                            <div className="p-4 sm:p-6">
                                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                                    <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                                        <ShieldCheck size={24} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="break-words text-sm font-bold text-gray-900">
                                            {product.distribution.targetTenantName || product.distribution.tenantName} ({product.distribution.targetTenantId || product.distribution.tenantId})
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {product.distribution.targetTenantType || product.distribution.tenantType} 파트너에게 권한 위임됨
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-5 border-t border-gray-50 pt-6 sm:grid-cols-2 sm:gap-6">
                                    <InfoItem icon={<ShieldCheck size={16} />} label="유통 상태" value={product.distribution.status === 'DISTRIBUTED' ? '유통 완료' : product.distribution.status || '-'} variant={product.distribution.status === 'DISTRIBUTED' ? 'success' : 'default'} />
                                    <InfoItem icon={<Clock size={16} />} label="유통 일시" value={product.distribution.distributedAt ? new Date(product.distribution.distributedAt).toLocaleString() : (product.distribution.grantedAt ? new Date(product.distribution.grantedAt).toLocaleString() : '-')} />
                                </div>
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <ShieldCheck size={24} className="text-gray-300" />
                                </div>
                                <p className="text-gray-400 font-medium tracking-tight">현재 위임된 유통 파트너가 없습니다.</p>
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                    {/* QR Code Section */}
                    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm group/qr sm:p-6">
                        <div className="p-3 bg-indigo-50 rounded-2xl mb-4 group-hover/qr:scale-110 transition-transform duration-300">
                            <QrCode size={24} className="text-indigo-600" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 mb-4 tracking-tight">제품 인증 QR 코드</h3>

                            <div className="relative mb-6 flex justify-center rounded-2xl border border-gray-50 bg-white p-3 shadow-inner">
                            {/* SVG for screen display */}
                            <QRCodeSVG
                                value={publicPassportUrl}
                                size={140}
                                level="H"
                                includeMargin={true}
                            />
                            {/* Canvas for downloading (hidden but accessible via ID) */}
                            <div className="hidden">
                                <QRCodeCanvas
                                    id="qr-canvas"
                                    value={publicPassportUrl}
                                    size={1024} // High resolution for download
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>
                        </div>

                        <div className="w-full space-y-3">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Public Verification Code</p>
                                <p className="inline-block break-all text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                    {product.qrPublicCode}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                                <button
                                    onClick={downloadQRCode}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 text-xs font-bold text-gray-700 shadow-sm transition-all hover:border-indigo-200 hover:bg-gray-50 cursor-pointer"
                                >
                                    <Download size={14} className="text-indigo-500" />
                                    이미지 저장
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-transparent bg-indigo-600 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 cursor-pointer"
                                >
                                    <Printer size={14} />
                                    QR 인쇄
                                </button>
                            </div>
                        </div>

                        <p className="mt-6 text-[10px] leading-relaxed text-gray-400">
                            이 QR 코드는 제품의 정품 여부를 공개 원장에서 확인하기 위한 코드입니다.
                        </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="rounded-2xl bg-indigo-600 p-5 text-white shadow-lg shadow-indigo-100 sm:p-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <CheckCircle2 size={18} />
                            최근 상태 요약
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-3 border-b border-indigo-500 pb-3 text-sm">
                                <span className="text-indigo-100">Asset State</span>
                                <span className="font-bold font-mono">{product.assetState}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-indigo-100">Risk Level</span>
                                <span className={`font-bold px-2 py-0.5 rounded ${product.riskFlag === 'NONE' ? 'bg-indigo-500' : 'bg-red-400'}`}>
                                    {product.riskFlag}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ProductManualSendModal
                isOpen={manualModalOpen}
                onClose={() => setManualModalOpen(false)}
                tenantId={user?.tenantId}
                passportId={passportId}
                productLabel={`${product.modelName} / ${product.serialNumber}`}
                recipientEmailMasked={manualRecipient?.recipientEmailMasked || ''}
                onSent={() => {
                    setManualModalOpen(false);
                    alert('메뉴얼 이메일을 전송했습니다.');
                }}
            />
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
        <div className="min-w-0 space-y-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                {icon}
                {label}
            </div>
            <div
                className={`flex min-w-0 flex-wrap items-center gap-2 break-all text-sm ${mono ? 'font-mono' : 'font-medium'} ${variantStyles[variant]} ${isCopyable ? 'cursor-pointer' : ''}`}
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
