import React, { useState, useEffect } from 'react';
import useAuthStore, { ROLES } from '../../store/useAuthStore';
import {
    Users,
    Link as LinkIcon,
    Plus,
    Trash2,
    Pause,
    Play,
    XOctagon,
    CheckCircle,
    AlertCircle,
    Calendar,
    MessageSquare,
    ChevronRight,
    Search
} from 'lucide-react';

const PartnershipAdmin = () => {
    const {
        user,
        partnerLinks,
        fetchPartnerLinks,
        createPartnerLink,
        suspendPartnerLink,
        resumePartnerLink,
        terminatePartnerLink,
        approvePartnerLink,
        rejectPartnerLink,
        searchTenants,
        myMemberships
    } = useAuthStore();

    const [loading, setLoading] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);

    // Form states
    const [linkForm, setLinkForm] = useState({
        targetTenantId: '',
        partnerType: 'RETAIL',
        proposedExpiresAt: '',
        message: ''
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState(null);

    const currentMembership = myMemberships.find(m => m.tenantId === user?.tenantId) || myMemberships[0];
    const isAdmin = currentMembership?.roleCodes?.some(r => r.toUpperCase().includes('ADMIN') || r.toUpperCase().includes('OWNER'));
    const isOwner = currentMembership?.roleCodes?.some(r => r.toUpperCase() === 'TENANT_OWNER');

    const hasScope = (scope) => {
        if (!currentMembership?.effectiveScopes) return false;
        return currentMembership.effectiveScopes.some(s =>
            s.toUpperCase() === scope.toUpperCase() ||
            s.toUpperCase() === `SCOPE_${scope.toUpperCase()}`
        );
    };

    const canCreateLink = isAdmin || hasScope('PARTNER_LINK_CREATE');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await fetchPartnerLinks();
            setLoading(false);
        };
        load();
    }, [fetchPartnerLinks]);

    const handleCreateLink = async (e) => {
        e.preventDefault();
        if (!selectedPartner) {
            alert('상대업체를 선택해주세요.');
            return;
        }
        const res = await createPartnerLink({
            ...linkForm,
            targetTenantId: selectedPartner.tenantId,
            proposedExpiresAt: linkForm.proposedExpiresAt ? new Date(linkForm.proposedExpiresAt).toISOString() : null
        });
        if (res.success) {
            alert('파트너십 요청이 생성되었습니다.');
            setShowLinkModal(false);
            setLinkForm({ targetTenantId: '', partnerType: 'RETAIL', proposedExpiresAt: '', message: '' });
            setSelectedPartner(null);
            setSearchQuery('');
        } else {
            alert('요청 생성 실패: ' + res.message);
        }
    };

    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2 || selectedPartner) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await searchTenants(searchQuery);
                if (res.success) {
                    setSearchResults(res.data);
                }
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, searchTenants, selectedPartner]);

    const incomingRequests = partnerLinks.filter(link =>
        link.status === 'PENDING' && link.targetTenantId === user?.tenantId
    );

    const myPartnerLinks = partnerLinks.filter(link =>
        !(link.status === 'PENDING' && link.targetTenantId === user?.tenantId)
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'ACTIVE': return 'text-green-600 bg-green-50 border-green-100';
            case 'PENDING': return 'text-amber-600 bg-amber-50 border-amber-100';
            case 'SUSPENDED': return 'text-gray-600 bg-gray-50 border-gray-100';
            case 'TERMINATED': return 'text-red-600 bg-red-50 border-red-100';
            default: return 'text-gray-400 bg-gray-50 border-gray-100';
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">파트너십 관리</h1>
                <p className="text-gray-500">다른 입점사(테넌트)와의 연결을 관리합니다.</p>
            </div>

            {/* Content Area */}
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">연결된 파트너 현황</h2>
                    {canCreateLink && (
                        <button
                            onClick={() => setShowLinkModal(true)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
                        >
                            <Plus size={18} />
                            새 파트너 요청
                        </button>
                    )}
                </div>

                {/* Incoming Requests Section */}
                {incomingRequests.length > 0 && (
                    <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6 mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertCircle className="text-amber-600" size={20} />
                            <h3 className="text-lg font-bold text-amber-900">승인 대기 중인 요청</h3>
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                {incomingRequests.length}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {incomingRequests.map(request => (
                                <div key={request.partnerLinkId} className="bg-white p-4 rounded-xl shadow-sm border border-amber-100 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-bold text-gray-900">{request.sourceTenantName || '요청업체'}</div>
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold">
                                                {request.sourceType || '알수없음'}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 mb-3">ID: {request.partnerLinkId}</div>
                                        <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-4 bg-gray-50 p-2 rounded-lg">
                                            <Calendar size={14} className="text-gray-400" />
                                            <span>만료: {request.expiresAt ? new Date(request.expiresAt).toLocaleDateString() : '무기한'}</span>
                                        </div>
                                    </div>
                                    {isOwner && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => approvePartnerLink(request.partnerLinkId)}
                                                className="flex-1 bg-indigo-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                                            >
                                                승인
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const reason = prompt('거절 사유를 입력하세요:');
                                                    if (reason) rejectPartnerLink(request.partnerLinkId, reason);
                                                }}
                                                className="flex-1 bg-white border border-red-200 text-red-600 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
                                            >
                                                거절
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">파트너 테넌트</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">유형</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">상태</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">만료일</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {myPartnerLinks.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400">데이터가 없습니다.</td>
                                </tr>
                            ) : (
                                myPartnerLinks.map(link => (
                                    <tr key={link.partnerLinkId} className="hover:bg-gray-50 transition-colors italic-none">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900">
                                                {link.sourceTenantId === user?.tenantId ? (link.targetTenantName || link.targetTenantId) : (link.sourceTenantName || link.sourceTenantId)}
                                            </div>
                                            <div className="text-[10px] text-gray-400">ID: {link.partnerLinkId}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold">
                                                {link.sourceTenantId === user?.tenantId ? link.partnerType : link.sourceType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(link.status)}`}>
                                                {link.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-[11px] text-gray-500 italic-none">
                                            {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : '무기한'}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            {isOwner && link.sourceTenantId === user?.tenantId && link.status === 'ACTIVE' && (
                                                <button
                                                    onClick={() => suspendPartnerLink(link.partnerLinkId)}
                                                    className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="일시 정지"
                                                >
                                                    <Pause size={18} />
                                                </button>
                                            )}
                                            {isOwner && link.sourceTenantId === user?.tenantId && link.status === 'SUSPENDED' && (
                                                <button
                                                    onClick={() => resumePartnerLink(link.partnerLinkId)}
                                                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                    title="재개"
                                                >
                                                    <Play size={18} />
                                                </button>
                                            )}
                                            {isOwner && link.sourceTenantId === user?.tenantId && !['REJECTED', 'TERMINATED'].includes(link.status) && (
                                                <button
                                                    onClick={() => {
                                                        const reason = prompt('해지 사유를 입력하세요:');
                                                        if (reason) terminatePartnerLink(link.partnerLinkId, reason);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="연결 해지 또는 요청 취소"
                                                >
                                                    <XOctagon size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for creating a new partner link */}
            {showLinkModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-8">
                            <h3 className="text-xl font-bold text-gray-900 mb-6">새 파트너 연결 요청</h3>
                            <form onSubmit={handleCreateLink} className="space-y-4">
                                <div className="relative">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">상대업체 (Partner Company)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="업체명 검색..."
                                            value={selectedPartner ? selectedPartner.name : searchQuery}
                                            onChange={e => {
                                                if (selectedPartner) setSelectedPartner(null);
                                                setSearchQuery(e.target.value);
                                            }}
                                            required={!selectedPartner}
                                        />
                                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        {selectedPartner && (
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedPartner(null); setSearchQuery(''); }}
                                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Search Results Dropdown */}
                                    {!selectedPartner && searchQuery.length >= 2 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                            {isSearching ? (
                                                <div className="p-4 text-center text-sm text-gray-400">검색 중...</div>
                                            ) : searchResults.length === 0 ? (
                                                <div className="p-4 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
                                            ) : (
                                                searchResults.map(tenant => (
                                                    <button
                                                        key={tenant.tenantId}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedPartner(tenant);
                                                            setSearchResults([]);
                                                            setSearchQuery('');
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex justify-between items-center transition-colors"
                                                    >
                                                        <div>
                                                            <div className="font-bold text-gray-900 text-sm">{tenant.name}</div>
                                                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">{tenant.type} · {tenant.region}</div>
                                                        </div>
                                                        <ChevronRight size={16} className="text-gray-300" />
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                    {selectedPartner && (
                                        <div className="mt-2 text-[10px] text-indigo-500 font-bold uppercase tracking-tight">
                                            ID: {selectedPartner.tenantId}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">파트너 유형</label>
                                    <select
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={linkForm.partnerType}
                                        onChange={e => setLinkForm({ ...linkForm, partnerType: e.target.value })}
                                    >
                                        <option value="BRAND">BRAND</option>
                                        <option value="RETAIL">RETAIL</option>
                                        <option value="SERVICE">SERVICE</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm font-bold text-gray-700">만료 요청일</label>
                                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!linkForm.proposedExpiresAt}
                                                onChange={(e) => {
                                                    setLinkForm({
                                                        ...linkForm,
                                                        proposedExpiresAt: e.target.checked ? '' : new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]
                                                    });
                                                }}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            무기한
                                        </label>
                                    </div>
                                    <input
                                        type="date"
                                        className={`w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${!linkForm.proposedExpiresAt ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                                        value={linkForm.proposedExpiresAt}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={e => setLinkForm({ ...linkForm, proposedExpiresAt: e.target.value })}
                                        disabled={!linkForm.proposedExpiresAt}
                                    />
                                    <p className="mt-1 text-[10px] text-gray-400 italic">파트너십이 자동으로 종료될 날짜를 지정합니다.</p>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowLinkModal(false)}
                                        className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                                    >
                                        요청 보내기
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PartnershipAdmin;
