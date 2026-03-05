import React, { useState } from 'react';
import { Layers, Plus, Save, Trash2, CheckCircle, Edit2 } from 'lucide-react';
import useAuthStore, { TENANT_ROLES } from '../../store/useAuthStore';

const TenantTemplateAdmin = () => {
    const {
        tenantTemplates, platformTemplates, roleBindings, rootPermissions,
        listTenantTemplates, listPlatformTemplates, listRoleBindings, listRootPermissions,
        createTenantTemplate, updateTenantTemplate, replaceTenantTemplatePermissions,
        bindTemplateToRole, unbindTemplateFromRole
    } = useAuthStore();

    const [selectedRole, setSelectedRole] = useState(TENANT_ROLES.OPERATOR);
    const [showModal, setShowModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({ code: '', name: '', description: '', permissions: [] });

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            await Promise.all([
                listTenantTemplates(),
                listPlatformTemplates(),
                listRoleBindings(),
                listRootPermissions()
            ]);
            setLoading(false);
        };
        fetchData();
    }, []);

    const allVisibleTemplates = [...platformTemplates, ...tenantTemplates];
    const boundTemplates = roleBindings[selectedRole] || [];
    const getTemplatePermissions = (template) => template?.permissionCodes || template?.permissions || [];

    const handleCreateOrUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const permArray = formData.permissions;

            if (editingTemplate) {
                await updateTenantTemplate(editingTemplate.code, {
                    name: formData.name,
                    description: formData.description
                });
                await replaceTenantTemplatePermissions(editingTemplate.code, permArray);
            } else {
                await createTenantTemplate({
                    code: formData.code,
                    name: formData.name,
                    description: formData.description,
                    enabled: true,
                    permissions: permArray
                });
            }
            closeModal();
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (template) => {
        setEditingTemplate(template);
        setFormData({
            code: template.code,
            name: template.name,
            description: template.description,
            permissions: [...getTemplatePermissions(template)]
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setEditingTemplate(null);
        setFormData({ code: '', name: '', description: '', permissions: [] });
        setShowModal(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <header className="flex justify-between items-center pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">템플릿 및 역할 기반 권한 관리</h1>
                    <p className="text-gray-500 mt-1">Tenant 커스텀 템플릿 관리 및 Role 기반 템플릿 바인딩 (Template Admin API)</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Side: Bind templates to Roles (API: 8, 9, 10) */}
                <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl shadow-sm p-6 max-h-[700px] overflow-y-auto">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-6">
                        <Layers size={20} className="text-indigo-500" /> 역할별 권한 세팅
                    </h2>

                    <div className="space-y-2 mb-6">
                        <label className="block text-sm font-semibold text-gray-700">관리할 역할 선택</label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 font-medium bg-gray-50"
                        >
                            <option value={TENANT_ROLES.ADMIN}>ADMIN (최고관리자)</option>
                            <option value={TENANT_ROLES.OPERATOR}>OPERATOR (운영자)</option>
                            <option value={TENANT_ROLES.STAFF}>STAFF (일반스탭)</option>
                        </select>
                    </div>

                    <div className="space-y-4">
                        <div className="text-sm font-semibold text-gray-700 pb-2 border-b border-gray-100">
                            할당 가능한 템플릿 목록 (Global + Tenant)
                        </div>

                        <div className="space-y-3">
                            {loading ? (
                                <div className="text-center py-8 text-gray-400 text-xs">로딩 중...</div>
                            ) : allVisibleTemplates.map(template => {
                                const isBound = boundTemplates.includes(template.code);
                                const isPlatform = platformTemplates.some(p => p.code === template.code);
                                return (
                                    <div key={template.code} className={`border rounded-lg p-3 transition-colors ${isBound ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                                                    {template.name}
                                                    {isPlatform && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-sm">Platform</span>}
                                                    {!isPlatform && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-sm">Custom</span>}
                                                </div>
                                                <div className="text-xs text-gray-500 line-clamp-1 mt-0.5" title={template.description}>{template.description}</div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={async () => {
                                                const res = isBound ? await unbindTemplateFromRole(selectedRole, template.code) : await bindTemplateToRole(selectedRole, template.code);
                                                if (!res.success) alert(res.message);
                                            }}
                                            className={`w-full py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 mt-2 transition-all ${isBound ? 'bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-100' : 'bg-gray-100 border border-transparent text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {isBound ? <><CheckCircle size={14} /> 할당됨 (Unbind)</> : <><Plus size={14} /> 할당하기 (Bind)</>}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Side: Manage Tenant Custom Templates (API: 1 ~ 7) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Tenant 커스텀 템플릿 목록</h2>
                            <p className="text-sm text-gray-500">이 업체에서만 독자적으로 사용하는 권한 묶음</p>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800"
                        >
                            <Plus size={16} /> 신규 템플릿 (생성)
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading ? (
                            <div className="col-span-full text-center py-20 text-gray-400">데이터를 불러오는 중...</div>
                        ) : tenantTemplates.map(template => (
                            <div key={template.code} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-gray-900 text-lg">{template.name}</h3>
                                    <code className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded">{template.code}</code>
                                </div>
                                <p className="text-sm text-gray-500 mb-4 h-10 line-clamp-2">{template.description}</p>

                                <div className="border-t border-gray-100 pt-3">
                                    <div className="text-xs font-semibold text-gray-400 mb-2">Permissions ({getTemplatePermissions(template).length})</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {getTemplatePermissions(template).map(perm => (
                                            <span key={perm} className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                                {perm}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-5 flex justify-end gap-2">
                                    <button onClick={() => openEditModal(template)} className="text-xs flex items-center gap-1 font-semibold text-gray-600 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 px-3 py-1.5 rounded-md">
                                        <Edit2 size={12} /> 내용/권한 수정
                                    </button>
                                </div>
                            </div>
                        ))}
                        {!loading && tenantTemplates.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-400 text-sm">
                                등록된 커스텀 템플릿이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal for Create/Update Tenant Template */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">{editingTemplate ? '커스텀 템플릿 수정' : '커스텀 템플릿 생성'}</h2>
                        <form onSubmit={handleCreateOrUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">템플릿 코드</label>
                                <input required type="text" value={formData.code} disabled={!!editingTemplate} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="w-full border border-gray-300 rounded-md px-4 py-2 uppercase placeholder:normal-case font-mono disabled:opacity-50 disabled:bg-gray-100" placeholder="TEMPLATE_TENANT_XXX" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">템플릿 이름</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border border-gray-300 rounded-md px-4 py-2" placeholder="Custom Marketing Worker" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">설명</label>
                                <textarea required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full border border-gray-300 rounded-md px-4 py-2" rows={2} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">권한 선택 (Permissions)</label>
                                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                                    {rootPermissions.map(perm => (
                                        <label key={perm.code} className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer hover:bg-white p-1.5 rounded transition">
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={formData.permissions.includes(perm.code)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        permissions: checked
                                                            ? [...prev.permissions, perm.code]
                                                            : prev.permissions.filter(p => p !== perm.code)
                                                    }));
                                                }}
                                            />
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">{perm.code}</span>
                                                    <span className="font-semibold text-gray-900">{perm.name}</span>
                                                </div>
                                                <span className="text-xs text-gray-500 mt-1">{perm.description}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 mt-2 border-t border-gray-100">
                                <button type="button" onClick={closeModal} className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                                <button type="submit" className="px-4 py-2 font-medium bg-gray-900 text-white hover:bg-gray-800 rounded-lg flex items-center gap-1">
                                    <Save size={16} /> 저장하기
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenantTemplateAdmin;
