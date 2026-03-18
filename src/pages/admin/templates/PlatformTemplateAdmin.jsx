import React, { useState } from 'react';
import { Plus, Edit2, ShieldAlert, Key, Save } from 'lucide-react';
import useAuthStore from '../../../store/useAuthStore';

const PlatformTemplateAdmin = () => {
    const {
        platformTemplates, rootPermissions,
        listPlatformTemplates, listRootPermissions,
        createPlatformTemplate, updatePlatformTemplate, replacePlatformTemplatePermissions,
        createRootPermission
    } = useAuthStore();

    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showPermModal, setShowPermModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [loading, setLoading] = useState(true);

    const [templateFormData, setTemplateFormData] = useState({ code: '', name: '', description: '', permissions: [] });
    const [permFormData, setPermFormData] = useState({ code: '', name: '', description: '', resourceType: 'PASSPORT', action: '' });

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            await Promise.all([
                listPlatformTemplates(),
                listRootPermissions()
            ]);
            setLoading(false);
        };
        fetchData();
    }, [listPlatformTemplates, listRootPermissions]);

    const handleTemplateSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const permArray = templateFormData.permissions;

            if (editingTemplate) {
                await updatePlatformTemplate(editingTemplate.code, {
                    name: templateFormData.name,
                    description: templateFormData.description
                });
                await replacePlatformTemplatePermissions(editingTemplate.code, permArray);
            } else {
                await createPlatformTemplate({
                    code: templateFormData.code,
                    name: templateFormData.name,
                    description: templateFormData.description,
                    enabled: true,
                    permissions: permArray
                });
            }
            closeTemplateModal();
        } finally {
            setLoading(false);
        }
    };

    const handlePermSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createRootPermission({ ...permFormData });
            setShowPermModal(false);
            setPermFormData({ code: '', name: '', description: '', resourceType: 'PASSPORT', action: '' });
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (template) => {
        setEditingTemplate(template);
        setTemplateFormData({
            code: template.code,
            name: template.name,
            description: template.description,
            permissions: [...template.permissions]
        });
        setShowTemplateModal(true);
    };

    const closeTemplateModal = () => {
        setEditingTemplate(null);
        setTemplateFormData({ code: '', name: '', description: '', permissions: [] });
        setShowTemplateModal(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <header className="flex justify-between items-center pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">플랫폼 퍼미션 & 템플릿 관리</h1>
                    <p className="text-gray-500 mt-1">시스템 최상위 권한 세팅 (template-platform-admin.http)</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Side: Root Permissions */}
                <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl shadow-sm p-6 overflow-y-auto max-h-[700px]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Key size={18} className="text-amber-500" /> Root Permissions
                        </h2>
                        <button onClick={() => setShowPermModal(true)} className="text-xs bg-gray-900 text-white px-2 py-1 rounded hover:bg-gray-800 flex items-center gap-1">
                            <Plus size={12} /> 생성
                        </button>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center py-8 text-gray-400 text-xs">로딩 중...</div>
                        ) : rootPermissions.map(perm => (
                            <div key={perm.code} className="border border-gray-100 bg-gray-50 rounded p-3">
                                <div className="font-bold text-xs text-gray-900 mb-1">{perm.name}</div>
                                <code className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1 py-0.5 rounded break-all">{perm.code}</code>
                                <div className="text-[10px] text-gray-500 mt-2 flex gap-2">
                                    <span className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded">Res: {perm.resourceType}</span>
                                    <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">Act: {perm.action}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Platform Templates */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">플랫폼 제공 권한 템플릿</h2>
                            <p className="text-sm text-gray-500">모든 테넌트가 공통으로 상속받거나 할당받을 수 있는 기본 템플릿</p>
                        </div>
                        <button
                            onClick={() => setShowTemplateModal(true)}
                            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition"
                        >
                            <Plus size={16} /> 템플릿 생성
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading ? (
                            <div className="col-span-full text-center py-20 text-gray-400">데이터를 불러오는 중...</div>
                        ) : platformTemplates.map((template) => (
                            <div key={template.code} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert size={16} className="text-purple-600" />
                                        <h3 className="font-bold text-gray-900">{template.name}</h3>
                                    </div>
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${template.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {template.enabled ? 'ENABLED' : 'DISABLED'}
                                    </span>
                                </div>

                                <code className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate block mb-2">{template.code}</code>
                                <p className="text-sm text-gray-600 mb-4 h-10">{template.description}</p>

                                <div className="border-t border-gray-100 pt-3">
                                    <div className="text-xs font-semibold text-gray-400 mb-2">Permissions ({template.permissions.length})</div>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {template.permissions.map(perm => (
                                            <span key={perm} className="text-[10px] px-1.5 py-0.5 border border-purple-200 text-purple-700 rounded bg-purple-50">
                                                {perm}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-end">
                                    <button onClick={() => openEditModal(template)} className="flex items-center gap-1 text-purple-600 text-xs font-semibold hover:underline bg-purple-50 px-2 py-1.5 rounded transition">
                                        <Edit2 size={12} /> 수정하기
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Template Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">{editingTemplate ? '플랫폼 템플릿 수정' : '플랫폼 템플릿 생성'}</h2>
                        <form onSubmit={handleTemplateSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">템플릿 코드</label>
                                <input required type="text" value={templateFormData.code} disabled={!!editingTemplate} onChange={e => setTemplateFormData({ ...templateFormData, code: e.target.value.toUpperCase() })} className="w-full border border-gray-300 rounded-md px-4 py-2 uppercase placeholder:normal-case font-mono disabled:bg-gray-100" placeholder="TEMPLATE_XXX" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">템플릿 이름</label>
                                <input required type="text" value={templateFormData.name} onChange={e => setTemplateFormData({ ...templateFormData, name: e.target.value })} className="w-full border border-gray-300 rounded-md px-4 py-2" placeholder="Platform Global Template" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">설명</label>
                                <textarea required value={templateFormData.description} onChange={e => setTemplateFormData({ ...templateFormData, description: e.target.value })} className="w-full border border-gray-300 rounded-md px-4 py-2" rows={2} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">권한 선택 (Permissions)</label>
                                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                                    {rootPermissions.map(perm => (
                                        <label key={perm.code} className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer hover:bg-white p-1.5 rounded transition">
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                checked={templateFormData.permissions.includes(perm.code)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setTemplateFormData(prev => ({
                                                        ...prev,
                                                        permissions: checked
                                                            ? [...prev.permissions, perm.code]
                                                            : prev.permissions.filter(p => p !== perm.code)
                                                    }));
                                                }}
                                            />
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">{perm.code}</span>
                                                    <span className="font-semibold text-gray-900">{perm.name}</span>
                                                </div>
                                                <span className="text-xs text-gray-500 mt-1">{perm.description}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 mt-2">
                                <button type="button" onClick={closeTemplateModal} className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                                <button type="submit" className="px-4 py-2 font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-lg flex items-center gap-1">
                                    <Save size={16} /> 저장
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Permission Modal */}
            {showPermModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">신규 Permission 생성</h2>
                        <form onSubmit={handlePermSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Code (Upper Case)</label>
                                <input required type="text" value={permFormData.code} onChange={e => setPermFormData({ ...permFormData, code: e.target.value.toUpperCase() })} className="w-full border border-gray-300 rounded-md px-4 py-2 uppercase font-mono" placeholder="PURCHASE_CLAIM_APPROVE" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                                <input required type="text" value={permFormData.name} onChange={e => setPermFormData({ ...permFormData, name: e.target.value })} className="w-full border border-gray-300 rounded-md px-4 py-2" placeholder="Purchase Claim Approve" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Resource Type</label>
                                <input required type="text" value={permFormData.resourceType} onChange={e => setPermFormData({ ...permFormData, resourceType: e.target.value.toUpperCase() })} className="w-full border border-gray-300 rounded-md px-4 py-2 uppercase font-mono" placeholder="PASSPORT" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Action</label>
                                <input required type="text" value={permFormData.action} onChange={e => setPermFormData({ ...permFormData, action: e.target.value.toUpperCase() })} className="w-full border border-gray-300 rounded-md px-4 py-2 uppercase font-mono" placeholder="RELEASE" />
                            </div>

                            <div className="flex gap-2 justify-end pt-4 mt-2">
                                <button type="button" onClick={() => setShowPermModal(false)} className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                                <button type="submit" className="px-4 py-2 font-medium bg-amber-600 text-white hover:bg-amber-700 rounded-lg flex items-center gap-1">
                                    <Save size={16} /> 생성
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlatformTemplateAdmin;
