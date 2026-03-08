import React, { useState, useEffect, useRef } from 'react';
import { Package, Search, Calendar, Filter, Download, Plus, FileDigit, Database, Factory, Hash, Code, Loader2, X, UploadCloud, FileText } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

// Role-based utility to fetch with Auth Token
const fetchWithAuth = async (url, options = {}) => {
    const token = useAuthStore.getState().accessToken;
    const response = await fetch(url, {
        ...options,
        headers: {
            // Only set Content-Type if it's not FormData (multipart)
            ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
    });
    if (!response.ok) {
        let errorMsg = `API Error: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
        } catch (e) {
            // parsing error skipped
        }
        throw new Error(errorMsg);
    }
    return response.status !== 204 ? response.json() : null;
};

const ProductManagement = () => {
    const { user, myMemberships } = useAuthStore();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [isMintModalOpen, setIsMintModalOpen] = useState(false);
    const [mintMode, setMintMode] = useState('single'); // 'single' or 'batch'
    const [mintLoading, setMintLoading] = useState(false);
    const fileInputRef = useRef(null);
    const [csvFile, setCsvFile] = useState(null);
    const [batchResult, setBatchResult] = useState(null);

    const [mintForm, setMintForm] = useState({
        serialNumber: '',
        modelName: '',
        manufacturedAt: '',
        modelId: '',
        productionBatch: '',
        factoryCode: '',
        componentRootHash: ''
    });

    const currentMembership = user?.tenantId
        ? myMemberships.find((m) =>
            m.tenantId === user.tenantId &&
            String(m.status).toUpperCase() === 'ACTIVE' &&
            String(m.groupType).toUpperCase() === 'BRAND'
        )
        : null;

    // 제품 등록(Mint) 버튼 노출 조건:
    // 1) 현재 로그인한 tenant membership의 roleCodes에 TENANT_OPERATOR가 있거나
    // 2) 현재 로그인한 tenant membership의 effectiveScopes에 BRAND_MINT가 있을 때만 허용
    const hasOperatorRole = currentMembership?.roleCodes?.some(
        r => String(r).toUpperCase() === 'TENANT_OPERATOR'
    ) ?? false;

    const hasBrandMintScope = currentMembership?.effectiveScopes?.some((s) => {
        const scope = String(s).toUpperCase();
        return scope === 'BRAND_MINT' || scope === 'SCOPE_BRAND_MINT';
    }) ?? false;

    const hasMintPermission = hasOperatorRole || hasBrandMintScope;

    const fetchProducts = async () => {
        if (!user?.tenantId) return;
        setLoading(true);
        try {
            // Updated to fetch paginated response
            const data = await fetchWithAuth(`/products/minted/passports?page=0&size=100`);
            const allProducts = data?.content || [];
            // 개인 소유(ownerId가 존재)로 넘어간 항목은 브랜드 제품 관리 목록에서 제외
            setProducts(allProducts.filter((item) => !item.ownerId));
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [user?.tenantId]);

    const handleMintChange = (e) => {
        const { name, value } = e.target;
        setMintForm(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setCsvFile(e.target.files[0]);
            setBatchResult(null); // Reset previous results
        }
    };

    const handleMintSubmit = async (e) => {
        e.preventDefault();
        if (!user?.tenantId) {
            alert('테넌트 정보가 없습니다.');
            return;
        }

        setMintLoading(true);
        setBatchResult(null);

        try {
            if (mintMode === 'single') {
                if (!mintForm.serialNumber || !mintForm.modelName || !mintForm.manufacturedAt) {
                    alert('필수 항목을 모두 입력해주세요.');
                    setMintLoading(false);
                    return;
                }
                const dateObj = new Date(mintForm.manufacturedAt);
                const formattedDate = dateObj.toISOString();

                const payload = {
                    serialNumber: mintForm.serialNumber,
                    modelName: mintForm.modelName,
                    manufacturedAt: formattedDate,
                    ...(mintForm.modelId && { modelId: mintForm.modelId }),
                    ...(mintForm.productionBatch && { productionBatch: mintForm.productionBatch }),
                    ...(mintForm.factoryCode && { factoryCode: mintForm.factoryCode }),
                    ...(mintForm.componentRootHash && { componentRootHash: mintForm.componentRootHash })
                };

                await fetchWithAuth(`/products/minted`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                alert('제품이 성공적으로 등록(Mint) 되었습니다.');
                closeMintModal();
                fetchProducts();
            } else {
                // Batch Upload Mode
                if (!csvFile) {
                    alert('CSV 파일을 선택해주세요.');
                    setMintLoading(false);
                    return;
                }

                const formData = new FormData();
                formData.append('file', csvFile);

                const data = await fetchWithAuth(`/products/minted/batch-upload`, {
                    method: 'POST',
                    body: formData
                });

                setBatchResult(data);
                if (data.totalMinted > 0) {
                    fetchProducts(); // Refresh list if any succeeded
                }
            }
        } catch (error) {
            console.error(error);
            alert(`DPP 발행 실패: ${error.message}`);
        } finally {
            setMintLoading(false);
        }
    };

    const closeMintModal = () => {
        setIsMintModalOpen(false);
        setMintMode('single');
        setCsvFile(null);
        setBatchResult(null);
        setMintForm({
            serialNumber: '', modelName: '', manufacturedAt: '',
            modelId: '', productionBatch: '', factoryCode: '', componentRootHash: ''
        });
    };

    const handleDownloadTemplate = () => {
        const header = "serial_number,model_id,model_name,manufactured_at,production_batch,factory_code,component_root_hash\n";
        const sampleRow = "SN-001,MODEL-01,Sample Product,2026-03-01T00:00:00Z,BATCH-1,FC-1,\n";
        const blob = new Blob([header + sampleRow], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "mint_batch_template.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusTheme = (status) => {
        switch (status) {
            case 'ACTIVE': return 'bg-green-100 text-green-700 border-green-200';
            case 'VOIDED': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getRiskTheme = (riskFlag) => {
        switch (riskFlag) {
            case 'NONE': return 'text-gray-400';
            case 'STOLEN': return 'text-red-500 font-bold';
            case 'LOST': return 'text-orange-500 font-bold';
            case 'DISPUTED': return 'text-yellow-600 font-bold';
            default: return 'text-gray-400';
        }
    };

    const filteredProducts = products.filter(p =>
        (p.modelName && p.modelName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.serialNumber && p.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                        <Package className="text-indigo-600" size={32} />
                        제품 관리 (Product Passports)
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">
                        테넌트에서 발행된 모든 제품(Passport) 목록을 조회합니다.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 transition-colors">
                        <Download size={16} />
                        CSV 다운로드
                    </button>
                    {hasMintPermission && (
                        <button
                            onClick={() => setIsMintModalOpen(true)}
                            className="flex items-center gap-2 bg-indigo-600 border border-transparent text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                            <Plus size={16} />
                            DPP 발행 (Mint)
                        </button>
                    )}
                </div>
            </div>

            {/* Config & Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between mb-6">
                <div className="relative flex-1 min-w-[300px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="모델명 또는 시리얼 번호 검색..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 transition-shadow"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors">
                        <Filter size={16} />
                        상태 필터
                    </button>
                    <button className="flex items-center gap-2 bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors">
                        <Calendar size={16} />
                        기간 설정
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제품 정보 (Model / Serial)</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Passport ID / Asset ID</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제조일 (Manufactured)</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">상태 (State / Risk)</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">현재 소유자</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-gray-400">데이터를 불러오는 중입니다...</td>
                            </tr>
                        ) : filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                                    <Package size={32} className="mx-auto mb-3 opacity-50" />
                                    발행된 제품 내역이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map((p) => (
                                <tr key={p.passportId} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">{p.modelName}</div>
                                        <div className="text-xs text-gray-500 mt-1 uppercase tracking-tight">{p.serialNumber}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[11px] font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block mb-1">P: {p.passportId.substring(0, 16)}...</div>
                                        <div className="text-[10px] text-gray-400 block">A: {p.assetId}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-700">
                                            {p.manufacturedAt ? new Date(p.manufacturedAt).toLocaleDateString() : '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1.5 items-start">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusTheme(p.assetState)}`}>
                                                {p.assetState}
                                            </span>
                                            <span className={`text-[10px] uppercase ${getRiskTheme(p.riskFlag)}`}>
                                                Risk: {p.riskFlag}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="text-xs font-medium text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                                            {p.ownerId || '소유자 없음'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mint Modal */}
            {isMintModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Plus className="text-indigo-600" size={24} />
                                DPP 발행 (Mint Passport)
                            </h2>
                            <button
                                onClick={closeMintModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 pt-4">
                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                <button
                                    onClick={() => setMintMode('single')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${mintMode === 'single' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    개별 등록
                                </button>
                                <button
                                    onClick={() => setMintMode('batch')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${mintMode === 'batch' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    일괄 등록 (CSV)
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleMintSubmit} className="p-6">
                            {mintMode === 'single' ? (
                                <div className="space-y-6">
                                    <h3 className="text-sm font-bold border-b pb-2 flex items-center gap-2">
                                        <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">필수</span>
                                        필수 기본 정보
                                    </h3>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                            <FileDigit size={14} className="text-gray-400" />
                                            시리얼 번호 (Serial Number) *
                                        </label>
                                        <input
                                            type="text"
                                            name="serialNumber"
                                            required
                                            value={mintForm.serialNumber}
                                            onChange={handleMintChange}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
                                            placeholder="예) SN-20260305-0001"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                                <Database size={14} className="text-gray-400" />
                                                모델명 (Model Name) *
                                            </label>
                                            <input
                                                type="text"
                                                name="modelName"
                                                required
                                                value={mintForm.modelName}
                                                onChange={handleMintChange}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
                                                placeholder="예) Cyber Sneaker V1"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                                <Calendar size={14} className="text-gray-400" />
                                                제조 일시 (Manufactured At) *
                                            </label>
                                            <input
                                                type="datetime-local"
                                                name="manufacturedAt"
                                                required
                                                value={mintForm.manufacturedAt}
                                                onChange={handleMintChange}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <h3 className="text-sm font-bold border-b pb-2 pt-4 flex items-center gap-2">
                                        <span className="bg-gray-100 text-gray-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">선택</span>
                                        추가 상세 정보
                                    </h3>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                            <Code size={14} className="text-gray-400" />
                                            모델 ID (Model ID)
                                        </label>
                                        <input
                                            type="text"
                                            name="modelId"
                                            value={mintForm.modelId}
                                            onChange={handleMintChange}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
                                            placeholder="예) MODEL-001"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                            <Factory size={14} className="text-gray-400" />
                                            생산 배치 / 공장 (Batch & Factory)
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                name="productionBatch"
                                                value={mintForm.productionBatch}
                                                onChange={handleMintChange}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
                                                placeholder="배치 예) BATCH-01"
                                            />
                                            <input
                                                type="text"
                                                name="factoryCode"
                                                value={mintForm.factoryCode}
                                                onChange={handleMintChange}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
                                                placeholder="공장 예) F-KR-01"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                            <Hash size={14} className="text-gray-400" />
                                            컴포넌트 해시 (Component Root Hash)
                                        </label>
                                        <input
                                            type="text"
                                            name="componentRootHash"
                                            value={mintForm.componentRootHash}
                                            onChange={handleMintChange}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors font-mono"
                                            placeholder="64자 고유 해시"
                                            maxLength={64}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 border-dashed text-center">
                                        <div className="mx-auto w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                                            <UploadCloud className="text-indigo-600" size={24} />
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-900 mb-2">CSV 파일 업로드</h3>
                                        <p className="text-xs text-gray-500 mb-6 max-w-sm mx-auto">
                                            제공된 양식에 맞게 작성된 CSV 파일을 업로드하여 여러 개의 제품을 한 번에 원장에 발행(Mint)할 수 있습니다.
                                        </p>

                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                        />

                                        <div className="flex flex-col items-center gap-3">
                                            {csvFile ? (
                                                <div className="bg-white border border-indigo-200 rounded-xl p-3 flex items-center justify-between w-64 shadow-sm">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <FileText className="text-indigo-500 shrink-0" size={16} />
                                                        <span className="text-xs font-bold text-gray-700 truncate">{csvFile.name}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setCsvFile(null); setBatchResult(null); }}
                                                        className="text-gray-400 hover:text-red-500 cursor-pointer p-1"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="px-5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors cursor-pointer"
                                                >
                                                    파일 선택
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={handleDownloadTemplate}
                                                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer"
                                            >
                                                CSV 템플릿 다운로드
                                            </button>
                                        </div>
                                    </div>

                                    {/* Batch Upload Result */}
                                    {batchResult && (
                                        <div className="mt-6 border rounded-xl overflow-hidden shadow-sm selection:bg-indigo-100">
                                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-gray-900">처리 결과</h4>
                                                <div className="flex items-center gap-3 text-xs font-medium">
                                                    <span className="text-gray-500">요청: {batchResult.totalRequested}건</span>
                                                    <span className="text-green-600">성공: {batchResult.totalMinted}건</span>
                                                    {batchResult.totalFailed > 0 && <span className="text-red-600">실패: {batchResult.totalFailed}건</span>}
                                                </div>
                                            </div>
                                            {batchResult.totalFailed > 0 && (
                                                <div className="max-h-48 overflow-y-auto bg-red-50/30 p-4">
                                                    <ul className="space-y-2">
                                                        {batchResult.errors?.map((err, idx) => (
                                                            <li key={idx} className="text-xs text-red-700 flex gap-2">
                                                                <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded text-[10px] shrink-0">Row {err.row}</span>
                                                                <span className="font-bold shrink-0">[{err.serialNumber}]</span>
                                                                <span className="truncate" title={err.reason}>{err.reason}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeMintModal}
                                    className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-bold bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    {batchResult ? '닫기' : '취소'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={mintLoading || (mintMode === 'batch' && !csvFile)}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 transition-colors ${(mintLoading || (mintMode === 'batch' && !csvFile)) ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'}`}
                                >
                                    {mintLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    {mintMode === 'single' ? '개별 발행 (Mint)' : '일괄 발행 (Batch Upload)'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductManagement;
