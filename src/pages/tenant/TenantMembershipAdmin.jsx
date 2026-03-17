import React, { useState, useEffect } from 'react';
import { Users, UserPlus, ShieldAlert, Check, X, Shield, Settings, Key, Mail, Building, Plus, Minus, UserCircle, ExternalLink, Phone, Fingerprint, Info } from 'lucide-react';
import useAuthStore, { ROLE_THEMES, TENANT_ROLES } from '../../store/useAuthStore';
import { getCurrentMembership, hasEffectiveScope } from '../../utils/permissionUi';

const LAST_ACTIVE_OWNER_MESSAGE = '시스템에 최소 한 명의 관리자가 필요합니다.';

const TenantMembershipAdmin = () => {
    const {
        myMemberships, tenantMemberships, listMemberships, inviteMember, updateMembershipStatus, assignRole, revokeRole,
        getMembershipDetail, user
    } = useAuthStore();

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState(TENANT_ROLES.STAFF);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [detailModalLoading, setDetailModalLoading] = useState(false);

    const currentUserMembership = getCurrentMembership(myMemberships, user?.tenantId, user?.role);
    const theme = ROLE_THEMES[user?.role];

    // invitation permission
    const hasInvitePermission = currentUserMembership?.roleCodes?.some(r => r.toUpperCase().includes('ADMIN') || r.toUpperCase().includes('OWNER')) ||
        hasEffectiveScope(currentUserMembership, 'TENANT_INVITATION_CREATE');

    // general management permission (status, roles)
    const hasManagePermission = currentUserMembership?.roleCodes?.some(r => r.toUpperCase().includes('ADMIN') || r.toUpperCase().includes('OWNER')) ||
        hasEffectiveScope(currentUserMembership, 'TENANT_ROLE_ASSIGN');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            await listMemberships();
            setLoading(false);
        };
        fetchData();
    }, [listMemberships]);

    const safeExecute = async (actionId, actionFn, successMessage) => {
        setActionLoading(actionId);
        try {
            const res = await actionFn();
            if (!res.success) {
                alert(res.message || '요청 처리에 실패했습니다.');
            } else if (successMessage) {
                // Success feedback
            }
        } finally {
            setActionLoading(null);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (inviteEmail) {
            await safeExecute('invite', async () => {
                const res = await inviteMember(inviteEmail, inviteRole);
                if (res.success) {
                    alert('발송이 완료되었습니다.');
                }
                return res;
            });
            setInviteEmail('');
        }
    };

    const handleRevokeInvitation = async (membershipId) => {
        if (!window.confirm('초대를 취소하시겠습니까?')) return;
        await safeExecute(`revoke-invitation-${membershipId}`, () => updateMembershipStatus(membershipId, 'SUSPENDED'), '초대가 취소되었습니다.');
    };

    const fetchDetail = async (membershipId) => {
        setDetailModalLoading(true);
        const res = await getMembershipDetail(membershipId);
        if (res.success) {
            setSelectedDetail(res.data);
        } else {
            alert(res.message || '상세 정보를 불러오지 못했습니다.');
        }
        setDetailModalLoading(false);
    };

    const roleDisplay = {
        [TENANT_ROLES.ADMIN]: { label: 'Admin', color: 'bg-[var(--role-bg)] text-[var(--role-primary)] border-[var(--role-border)]' },
        [TENANT_ROLES.OPERATOR]: { label: 'Operator', color: 'bg-[var(--role-bg)] text-[var(--role-primary)] border-[var(--role-border)]' },
        [TENANT_ROLES.STAFF]: { label: 'Staff', color: 'bg-slate-50 text-slate-700 border-slate-100' }
    };

    const pendingMemberships = (tenantMemberships || []).filter(m => ['PENDING', 'INVITED'].includes(String(m.status).toUpperCase()));
    const activeMemberships = (tenantMemberships || []).filter(m => !['PENDING', 'INVITED'].includes(String(m.status).toUpperCase()));
    const activeOwnerMemberships = activeMemberships.filter((membership) =>
        String(membership?.status).toUpperCase() === 'ACTIVE' &&
        (membership?.roleCodes || []).some((roleCode) => String(roleCode).toUpperCase() === TENANT_ROLES.ADMIN)
    );
    const visibleMembershipCount = activeMemberships.length + pendingMemberships.length;

    const renderMembershipCard = (m) => {
        const membershipId = m.membershipId || m.id || null;
        const isStatusActive = m.status === 'ACTIVE';
        const isSuspended = m.status === 'SUSPENDED';
        const canManageMembership = hasManagePermission && !!membershipId;
        const canOpenDetail = !!membershipId;
        const isOwner = (m.roleCodes || []).some((roleCode) => String(roleCode).toUpperCase() === TENANT_ROLES.ADMIN);
        const isCurrentUserMembership = currentUserMembership?.membershipId === membershipId;
        const isLastActiveOwner = isStatusActive
            && isOwner
            && activeOwnerMemberships.length === 1
            && activeOwnerMemberships[0]?.membershipId === membershipId;
        const isSelfSuspendBlocked = isLastActiveOwner && isCurrentUserMembership;
        const suspendDisabled = actionLoading === `status-${membershipId}` || !canManageMembership || isLastActiveOwner;

        return (
            <div
                key={membershipId || `${m.userEmail || m.inviteeEmail || 'membership'}-${m.status}`}
                onClick={() => {
                    if (canOpenDetail) {
                        fetchDetail(membershipId);
                    }
                }}
                className={`bg-white border border-gray-100 rounded-2xl p-5 shadow-sm transition-all relative overflow-hidden group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${canOpenDetail ? 'cursor-pointer hover:shadow-md' : ''}`}
                style={{ ['--role-primary']: theme?.primary, ['--role-bg']: theme?.bg, ['--role-border']: theme?.border }}
            >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${isStatusActive ? 'bg-green-500' : isSuspended ? 'bg-red-500' : 'bg-yellow-400'}`} />

                <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 border border-slate-100 group-hover:scale-105 transition-transform">
                        <UserCircle size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-sm">{m.userEmail || m.inviteeEmail || '알 수 없는 사용자'}</h3>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (canOpenDetail) {
                                        fetchDetail(membershipId);
                                    }
                                }}
                                disabled={!canOpenDetail}
                                className="p-1 text-slate-300 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                                style={{ color: undefined }}
                                title={canOpenDetail ? '상세 정보 보기' : '멤버십 상세 ID가 없어 상세 조회를 할 수 없습니다.'}
                            >
                                <Info size={14} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {Object.entries(TENANT_ROLES).map(([, role]) => {
                                const hasRole = (m.roleCodes || []).some(rc => rc.toUpperCase() === role.toUpperCase());
                                if (!hasRole) return null;
                                return (
                                    <span key={role} className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleDisplay[role].color}`}>
                                        {roleDisplay[role].label}
                                    </span>
                                );
                            })}
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase ${isStatusActive ? 'bg-green-50 text-green-700 border-green-100'
                                : isSuspended ? 'bg-red-50 text-red-700 border-red-100'
                                    : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                                }`}>
                                {m.status}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                    {hasManagePermission && (
                        <>
                            <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                                {Object.values(TENANT_ROLES).map(role => {
                                    const hasRole = (m.roleCodes || []).some(rc => rc.toUpperCase() === role.toUpperCase());
                                    const isProcessing = actionLoading === `role-${membershipId}-${role}`;
                                    const isOwnerRoleRevokeBlocked = isLastActiveOwner && hasRole && role === TENANT_ROLES.ADMIN;
                                    return (
                                        <button
                                            key={role}
                                            onClick={() => safeExecute(`role-${membershipId}-${role}`, () => hasRole ? revokeRole(membershipId, role) : assignRole(membershipId, role))}
                                            disabled={isProcessing || !canManageMembership || isOwnerRoleRevokeBlocked}
                                            title={isOwnerRoleRevokeBlocked ? LAST_ACTIVE_OWNER_MESSAGE : roleDisplay[role].label}
                                            className={`p-1.5 rounded-md transition-all ${hasRole
                                                ? 'bg-white shadow-sm'
                                                : 'text-slate-400 hover:text-slate-600'
                                                } disabled:cursor-not-allowed disabled:opacity-50`}
                                            style={hasRole ? { color: theme?.primary, border: `1px solid ${theme?.border}` } : {}}
                                        >
                                            {isProcessing ? (
                                                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                            ) : hasRole ? (
                                                <Check size={14} />
                                            ) : (
                                                <Plus size={14} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="h-6 w-px bg-slate-100" />

                            <button
                                onClick={() => safeExecute(`status-${membershipId}`, () => updateMembershipStatus(membershipId, isStatusActive ? 'SUSPENDED' : 'ACTIVE'))}
                                disabled={suspendDisabled}
                                title={isLastActiveOwner ? LAST_ACTIVE_OWNER_MESSAGE : undefined}
                                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isStatusActive
                                    ? 'bg-white border-red-100 text-red-600 hover:bg-red-50'
                                    : 'bg-white border-green-100 text-green-600 hover:bg-green-50'
                                    } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                                {actionLoading === `status-${membershipId}` ? '처리중' : isStatusActive ? '정지' : '활성화'}
                            </button>
                        </>
                    )}
                </div>
                {isLastActiveOwner && (
                    <div className="w-full text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        {isSelfSuspendBlocked ? LAST_ACTIVE_OWNER_MESSAGE : '마지막 활성 관리자 계정은 정지하거나 Owner 권한을 해제할 수 없습니다.'}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">멤버십 관리</h1>
                <p className="text-gray-500">소속 팀원의 권한과 계정 상태를 실시간으로 제어합니다.</p>
            </div>

            {/* Top Layout: Invite Section */}
            <div className="space-y-6">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: theme?.bg, color: theme?.primary }}>
                                <UserPlus size={20} />
                            </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">새로운 팀원 초대</h2>
                            <p className="text-slate-500 text-sm">이메일을 통해 멤버를 초대하고 초기 권한을 부여하세요.</p>
                        </div>
                    </div>

                    {!hasInvitePermission ? (
                        <div className="text-amber-600 bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3 italic text-xs">
                            <ShieldAlert size={16} className="shrink-0" />
                            <p>멤버십 초대 권한이 없습니다. 관리자에게 문의하세요.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">이메일 주소</label>
                                <input
                                    required
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 outline-none transition-all text-sm"
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="w-full md:w-64">
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">초기 권한</label>
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 outline-none transition-all appearance-none text-sm bg-white"
                                >
                                    <option value={TENANT_ROLES.STAFF}>Staff (일반)</option>
                                    <option value={TENANT_ROLES.OPERATOR}>Operator (운영)</option>
                                    <option value={TENANT_ROLES.ADMIN}>Admin (관리)</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={actionLoading === 'invite'}
                                className="w-full md:w-auto text-white px-8 py-2.5 rounded-xl font-bold transition-all flex justify-center items-center gap-2 h-[46px] disabled:opacity-60"
                                style={{ backgroundColor: theme?.primary, boxShadow: `0 16px 36px ${theme?.border}` }}
                            >
                                {actionLoading === 'invite' ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : '초대 발송'}
                            </button>
                        </form>
                    )}

                    {/* Pending Invitations list below the form */}
                    {hasInvitePermission && pendingMemberships.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest">초대 대기 중 ({pendingMemberships.length})</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {pendingMemberships.map(inv => (
                                    <div key={inv.membershipId} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex justify-between items-center group">
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-800 truncate">{inv.userEmail || inv.inviteeEmail}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-tighter">{inv.roleCodes?.join(', ')}</div>
                                        </div>
                                        <button
                                            onClick={() => handleRevokeInvitation(inv.membershipId)}
                                            disabled={actionLoading === `revoke-invitation-${inv.membershipId}`}
                                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-lg border border-slate-100 shadow-sm"
                                            title="초대 취소"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* List Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            소속 멤버
                            <span className="px-3 py-1 rounded-full text-xs" style={{ color: theme?.primary, backgroundColor: theme?.bg }}>{visibleMembershipCount}</span>
                        </h2>
                    </div>

                    {loading ? (
                        <div className="bg-white border text-center border-slate-200 rounded-3xl py-24">
                            <div className="w-8 h-8 border-3 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: `${theme?.primary}20`, borderTopColor: theme?.primary }} />
                            <p className="text-slate-400 text-sm font-medium">데이터를 불러오는 중...</p>
                        </div>
                    ) : activeMemberships.length === 0 ? (
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl py-24 text-center">
                            <Users size={40} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="text-slate-600 font-bold mb-1">등록된 팀원이 없습니다.</h3>
                            <p className="text-slate-400 text-sm">상단 폼을 이용하여 멤버를 초대하세요.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {activeMemberships.map(renderMembershipCard)}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            {selectedDetail && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: theme?.primary }} />

                        <button
                            onClick={() => setSelectedDetail(null)}
                            className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center mb-8 pt-4">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-lg" style={{ backgroundColor: theme?.bg, color: theme?.primary, boxShadow: `0 12px 28px ${theme?.border}` }}>
                                <UserCircle size={48} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 break-all">{selectedDetail.userAccount?.email}</h2>
                            <p className="text-slate-400 text-[10px] font-mono mt-1 tracking-tight">ID: {selectedDetail.membershipId}</p>

                            <div className="flex gap-2 mt-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase ${selectedDetail.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    MEMBER: {selectedDetail.status}
                                </span>
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold border uppercase" style={{ backgroundColor: theme?.bg, color: theme?.primary, borderColor: theme?.border }}>
                                    USER: {selectedDetail.userAccount?.status || 'N/A'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">계정 연락 정보</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-white rounded-lg shadow-sm text-slate-400 border border-slate-50">
                                            <Mail size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Email</div>
                                            <div className="text-sm font-bold text-slate-800 truncate">{selectedDetail.userAccount?.email || '-'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-white rounded-lg shadow-sm text-slate-400 border border-slate-50">
                                            <Phone size={16} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Phone</div>
                                            <div className="text-sm font-bold text-slate-800">{selectedDetail.userAccount?.phone || '미등록'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">신원 및 권한 정보</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm text-amber-500 border border-slate-50">
                                            <Fingerprint size={16} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Verify</div>
                                            <div className="text-xs font-bold text-slate-800">{selectedDetail.userAccount?.verificationLevel || 'LEVEL0'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="p-2 bg-white rounded-lg shadow-sm border border-slate-50"
                                            style={{ color: theme?.primary }}
                                        >
                                            <Shield size={16} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Roles</div>
                                            <div className="text-xs font-bold text-slate-800">{selectedDetail.roleCodes?.length || 0} 할당됨</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedDetail(null)}
                            className="w-full mt-8 py-3.5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}

            {/* Loading Overlay for Detail Fetch */}
            {detailModalLoading && (
                <div className="fixed inset-0 bg-white/60 backdrop-blur-[2px] z-[60] flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <div
                        className="w-12 h-12 rounded-full animate-spin mb-4 border-4"
                        style={{ borderColor: `${theme?.primary}20`, borderTopColor: theme?.primary }}
                    />
                    <p className="font-bold text-sm tracking-widest animate-pulse" style={{ color: theme?.primary }}>
                        상세 정보 조회 중...
                    </p>
                </div>
            )}
        </div>
    );
};

export default TenantMembershipAdmin;
