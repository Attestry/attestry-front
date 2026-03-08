import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Package, ArrowLeft, Calendar, Hash, FileText, Download, User,
    Clock, CheckCircle2, AlertTriangle, Loader2, ShieldCheck,
    RotateCcw
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

// Local API Fetch Helper matching the store
const apiFetch = async (url, options = {}) => {
    const token = useAuthStore.getState().accessToken;
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        let errorMsg = 'API Error';
        try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
        } catch (e) { }
        throw new Error(errorMsg);
    }

    if (response.status === 204) return null;
    return response.json();
};

const ShipmentHistoryDetail = () => {
    const { shipmentId } = useParams();
    const navigate = useNavigate();
    const { user, myMemberships } = useAuthStore();
    const [shipment, setShipment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Get current tenant's group info
    const currentMembership = user?.tenantId
        ? myMemberships.find((m) =>
            m.tenantId === user.tenantId &&
            String(m.status).toUpperCase() === 'ACTIVE' &&
            String(m.groupType).toUpperCase() === 'BRAND'
        )
        : null;

    const fetchShipmentDetail = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch(`/workflows/shipments/${shipmentId}`);
            setShipment(data);
        } catch (err) {
            console.error("Failed to fetch shipment detail:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (shipmentId) {
            fetchShipmentDetail();
        }
    }, [shipmentId]);

    const handleBack = () => {
        navigate(-1);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
                <Loader2 size={40} className="animate-spin mb-4 text-indigo-500" />
                <p className="font-medium">출고 정보를 불러오는 중입니다...</p>
            </div>
        );
    }

    if (error || !shipment) {
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
                    <p className="text-red-600 font-medium">{error || "출고 정보를 찾을 수 없습니다."}</p>
                </div>
            </div>
        );
    }

    const isReleased = shipment.status === 'RELEASED';
    const isReturned = shipment.status === 'RETURNED';

    return (
        <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
            {/* Navigation & Header */}
            <div className="mb-8">
                <Link
                    to={`/${currentMembership?.groupType.toLowerCase()}/release?tab=history`}
                    className="flex items-center gap-2 text-gray-400 hover:text-indigo-600 font-bold mb-4 transition-colors cursor-pointer group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    목록으로 돌아가기
                </Link>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                            출고 상세 정보
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${isReleased
                                ? 'bg-green-50 text-green-700 border-green-100'
                                : isReturned ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-gray-100 text-gray-700 border-gray-200'
                                }`}>
                                {isReleased ? '출고완료' : isReturned ? '반송됨' : shipment.status}
                            </span>
                        </h1>
                        <p className="text-gray-500 mt-1 font-mono text-sm uppercase tracking-wider">
                            ID: {shipment.shipmentId}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Shipment Details */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Shipment Info Card */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                            <Package size={18} className="text-indigo-500" />
                            <h2 className="font-bold text-gray-900">운송 및 처리 정보</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                            <InfoItem icon={<Package size={16} />} label="제품명 (Model)" value={shipment.modelName || '-'} />
                            <InfoItem icon={<Hash size={16} />} label="시리얼 번호 (S/N)" value={shipment.serialNumber || '-'} isCopyable />
                            <InfoItem icon={<Hash size={16} />} label="Passport ID" value={shipment.passportId} mono isCopyable />
                            <InfoItem icon={<RotateCcw size={16} />} label="출고 회차" value={`${shipment.shipmentRound}회차`} />

                            <InfoItem
                                icon={<Calendar size={16} />}
                                label="출고 일시"
                                value={shipment.releasedAt ? new Date(shipment.releasedAt).toLocaleString() : '-'}
                            />
                            <InfoItem
                                icon={<User size={16} />}
                                label="출고 처리자"
                                value={shipment.releasedByUserEmail}
                                mono
                            />

                            {isReturned && (
                                <>
                                    <InfoItem
                                        icon={<Calendar size={16} />}
                                        label="반송 일시"
                                        value={shipment.returnedAt ? new Date(shipment.returnedAt).toLocaleString() : '-'}
                                    />
                                    <InfoItem
                                        icon={<User size={16} />}
                                        label="반송 처리자 이메일"
                                        value={shipment.returnedByUserEmail || '-'}
                                        mono
                                    />
                                </>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <Link
                                to={`/${currentMembership?.groupType.toLowerCase()}/products/${shipment.passportId}`}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                                제품 상세 정보 보기 <ShieldCheck size={14} />
                            </Link>
                        </div>
                    </section>

                    {/* Evidence Files Card */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                            <FileText size={18} className="text-blue-500" />
                            <h2 className="font-bold text-gray-900">증빙 자료 (Evidence)</h2>
                        </div>
                        <div className="p-6 space-y-8">
                            {/* Release Evidence */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                                    <h3 className="text-sm font-bold text-gray-900">출고 증빙 서류</h3>
                                </div>
                                {shipment.releaseEvidenceFiles?.length > 0 ? (
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {shipment.releaseEvidenceFiles.map((file) => (
                                            <EvidenceItem key={file.evidenceId} file={file} />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="py-8 text-center border-2 border-dashed border-gray-50 rounded-2xl">
                                        <p className="text-xs text-gray-400 font-medium">첨부된 출고 증빙 자료가 없습니다.</p>
                                    </div>
                                )}
                            </div>

                            {/* Return Evidence (Only if returned or has files) */}
                            {(isReturned || shipment.returnEvidenceFiles?.length > 0) && (
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
                                        <h3 className="text-sm font-bold text-gray-900">반송 증빙 서류</h3>
                                    </div>
                                    {shipment.returnEvidenceFiles?.length > 0 ? (
                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {shipment.returnEvidenceFiles.map((file) => (
                                                <EvidenceItem key={file.evidenceId} file={file} variant="warning" />
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="py-8 text-center border-2 border-dashed border-gray-50 rounded-2xl">
                                            <p className="text-xs text-gray-400 font-medium">첨부된 반송 증빙 자료가 없습니다.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column: Status Summary */}
                <div className="space-y-8">
                    <div className={`rounded-2xl p-6 text-white shadow-lg ${isReleased ? 'bg-indigo-600 shadow-indigo-100' : isReturned ? 'bg-orange-500 shadow-orange-100' : 'bg-gray-600'}`}>
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <CheckCircle2 size={18} />
                            처리 상태 요약
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm border-b border-white/20 pb-3">
                                <span>현재 상태</span>
                                <span className="font-bold">{isReleased ? '출고 완료' : isReturned ? '반송 완료' : shipment.status}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-white/20 pb-3">
                                <span>최종 업데이트</span>
                                <span className="font-bold">{new Date(shipment.releasedAt || shipment.returnedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span>회차 정보</span>
                                <span className="font-bold">{shipment.shipmentRound}회차</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Clock size={16} className="text-gray-400" />
                            타임라인
                        </h3>
                        <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-50">
                            <TimelineItem
                                title="출고 처리"
                                date={shipment.releasedAt}
                                user={shipment.releasedByUserId}
                                active={isReleased || isReturned}
                            />
                            {isReturned && (
                                <TimelineItem
                                    title="제품 반송"
                                    date={shipment.returnedAt}
                                    user={shipment.returnedByUserId}
                                    active={isReturned}
                                    variant="warning"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InfoItem = ({ icon, label, value, mono = false, isCopyable = false }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!isCopyable) return;
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                {icon}
                {label}
            </div>
            <div
                className={`text-sm truncate flex items-center gap-2 ${mono ? 'font-mono' : 'font-medium'} text-gray-900 ${isCopyable ? 'cursor-pointer' : ''}`}
                onClick={handleCopy}
            >
                {value}
                {isCopyable && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-400 hover:text-indigo-600'}`}>
                        {copied ? 'Copied!' : 'Copy'}
                    </span>
                )}
            </div>
        </div>
    );
};

const TimelineItem = ({ title, date, user, active, variant = 'default' }) => {
    return (
        <div className="relative pl-8">
            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm z-10 ${active
                ? variant === 'warning' ? 'bg-orange-400' : 'bg-indigo-500'
                : 'bg-gray-200'
                }`} />
            <div>
                <h4 className={`text-sm font-bold ${active ? 'text-gray-900' : 'text-gray-400'}`}>{title}</h4>
                {date && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(date).toLocaleString()} • {user}
                    </p>
                )}
            </div>
        </div>
    );
}

const EvidenceItem = ({ file, variant = 'default' }) => {
    const iconColor = variant === 'warning' ? 'text-orange-500' : 'text-indigo-500';
    const borderColor = variant === 'warning' ? 'hover:border-orange-200 hover:bg-orange-50/30' : 'hover:border-indigo-200 hover:bg-indigo-50/30';

    return (
        <li className={`group p-4 border border-gray-100 rounded-xl transition-all ${borderColor}`}>
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm text-center">
                    <FileText size={20} className={`text-gray-400 group-hover:${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate" title={file.originalFileName}>
                        {file.originalFileName}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase">
                        {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB • {file.contentType.split('/')[1] || 'FILE'}
                    </p>
                </div>
                <a
                    href={file.downloadUrl}
                    download={file.originalFileName}
                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors bg-gray-50 rounded-lg"
                    title="다운로드"
                >
                    <Download size={18} />
                </a>
            </div>
        </li>
    );
};

export default ShipmentHistoryDetail;
