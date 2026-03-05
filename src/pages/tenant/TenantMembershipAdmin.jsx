import React, { useState } from 'react';
import { Users, UserPlus, ShieldAlert, Check, X, ShieldPlus } from 'lucide-react';
import useAuthStore, { TENANT_ROLES } from '../../store/useAuthStore';

const TenantMembershipAdmin = () => {
    const {
        memberships, listMemberships, inviteMember, updateMembershipStatus, assignRole, revokeRole,
        applyTemplateToMembership, revokeTemplateFromMembership, user, tenantTemplates, platformTemplates,
        listTenantTemplates, listPlatformTemplates
    } = useAuthStore();

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState(TENANT_ROLES.STAFF);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            await Promise.all([
                listMemberships(),
                listTenantTemplates(),
                listPlatformTemplates()
            ]);
            setLoading(false);
        };
        fetchData();
    }, []);

    // Filter memberships by current user's tenant
    const tenantMemberships = memberships;
    const availableTemplates = [...platformTemplates, ...tenantTemplates];

    const handleInvite = async (e) => {
        e.preventDefault();
        if (inviteEmail) {
            const res = await inviteMember(inviteEmail, inviteRole);
            if (res.success) {
                setInviteEmail('');
                alert('초대가 발송되었습니다.');
            } else {
                alert(res.message);
            }
        }
    };

    const roleDisplay = {
        [TENANT_ROLES.ADMIN]: 'Admin',
        [TENANT_ROLES.OPERATOR]: 'Operator',
        [TENANT_ROLES.STAFF]: 'Staff'
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <header className="flex justify-between items-center pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">멤버십 관리 (Membership Admin)</h1>
                    <p className="text-gray-500 mt-1">membership-admin.http 전체 스펙 기반 권한/템플릿 부여 플로우</p>
                </div>
            </header>

            {/* 1) Invite Form */}
            <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <UserPlus size={20} className="text-blue-500" /> 신규 멤버 초대
                </h2>
                <form onSubmit={handleInvite} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">이메일 주소</label>
                        <input required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full border border-gray-300 rounded-md px-4 py-2" placeholder="member@company.com" />
                    </div>
                    <div className="w-48">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">초기 권한 (Role)</label>
                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full border border-gray-300 rounded-md px-4 py-2">
                            <option value={TENANT_ROLES.STAFF}>Staff</option>
                            <option value={TENANT_ROLES.OPERATOR}>Operator</option>
                            <option value={TENANT_ROLES.ADMIN}>Admin</option>
                        </select>
                    </div>
                    <button type="submit" className="bg-gray-900 text-white px-6 py-2 rounded-md font-medium hover:bg-gray-800 h-10">
                        초대 발송
                    </button>
                </form>
            </div>

            {/* 3) List memberships */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <Users size={20} className="text-gray-600" />
                    <h2 className="font-bold text-lg text-gray-800">멤버십 상태 및 직접 템플릿 부여</h2>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center py-12 text-gray-400">
                        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mb-4" />
                        데이터를 불러오는 중...
                    </div>
                ) : tenantMemberships.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 italic">표시할 멤버십이 없습니다.</div>
                ) : tenantMemberships.map((m) => (
                    <div key={m.membershipId} className="border border-gray-200 rounded-lg p-5">

                        <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-100">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-lg text-gray-900">Membership {m.membershipId}</h3>
                                    {/* 4) Update membership status */}
                                    <button
                                        onClick={async () => {
                                            const res = await updateMembershipStatus(m.membershipId, m.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
                                            if (!res.success) alert(res.message);
                                        }}
                                        className={`px-2 py-0.5 text-xs font-bold rounded-full border ${m.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                                            : m.status === 'INVITED' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                                                : 'bg-red-50 text-red-700 border-red-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                                            }`}
                                        title="클릭하여 상태 변경"
                                    >
                                        {m.status} (클릭하여 토글)
                                    </button>
                                </div>
                                <div className="text-sm text-gray-500 mt-1">ID: {m.membershipId}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Roles Management (8, 9) Assign/Revoke Role */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    부여된 역할 (Roles)
                                </h4>
                                <div className="flex gap-2 flex-wrap">
                                    {Object.values(TENANT_ROLES).map(role => {
                                        const hasRole = (m.roleCodes || []).includes(role);
                                        return (
                                            <button
                                                key={role}
                                                onClick={async () => {
                                                    const res = hasRole ? await revokeRole(m.membershipId, role) : await assignRole(m.membershipId, role);
                                                    if (!res.success) alert(res.message);
                                                }}
                                                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${hasRole ? 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-500'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                {hasRole && <Check size={12} className="inline mr-1" />}
                                                {roleDisplay[role]}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-400 mt-2">클릭하여 Role을 할당/회수 할 수 있습니다.</p>
                            </div>

                            {/* Permissions Templates Management (10, 11) Apply/Revoke template to membership */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    해당 멤버 전용 템플릿 직접 부여
                                </h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                    {availableTemplates.map(template => {
                                        return (
                                            <div key={template.code} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                                                <span className="text-xs font-medium text-gray-700">{template.name}</span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={async () => {
                                                            const res = await applyTemplateToMembership(m.membershipId, template.code);
                                                            if (!res.success) alert(res.message);
                                                        }}
                                                        className="text-xs px-2 py-1 rounded font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                                                    >
                                                        Apply
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const res = await revokeTemplateFromMembership(m.membershipId, template.code);
                                                            if (!res.success) alert(res.message);
                                                        }}
                                                        className="text-xs px-2 py-1 rounded font-semibold bg-red-50 text-red-600 hover:bg-red-100"
                                                    >
                                                        Revoke
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TenantMembershipAdmin;
