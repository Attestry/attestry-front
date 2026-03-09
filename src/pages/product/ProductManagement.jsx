import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Calendar, Filter, Download, Plus, FileDigit, Database, Factory, Hash, Code, Loader2, X, UploadCloud, FileText, AlertCircle } from 'lucide-react';
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
    const navigate = useNavigate();
    const { user, myMemberships } = useAuthStore();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [assetStateFilter, setAssetStateFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Pagination/Infinite Scroll states
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalElements, setTotalElements] = useState(0);
    const observerTarget = useRef(null);

    // Modal states
    const [isMintModalOpen, setIsMintModalOpen] = useState(false);
    const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
    const [selectedPassportId, setSelectedPassportId] = useState(null);
    const [voidForm, setVoidForm] = useState({ reason: 'COUNTERFEIT_DETECTED', note: '' });
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

    // DPP 발행(Mint) 버튼 노출 조건:
    // 오직 현재 로그인한 tenant membership의 effectiveScopes에 BRAND_MINT가 존재할 때만 허용
    const hasMintPermission = currentMembership?.effectiveScopes?.some((s) => {
        const scope = String(s).toUpperCase();
        return scope === 'BRAND_MINT' || scope === 'SCOPE_BRAND_MINT';
    }) ?? false;

    // Void 버튼 노출 조건: BRAND_VOID 스코프
    const hasVoidPermission = currentMembership?.effectiveScopes?.some((s) => {
        const scope = String(s).toUpperCase();
        return scope === 'BRAND_VOID' || scope === 'SCOPE_BRAND_VOID';
    }) ?? false;

    const fetchProducts = async (pageNum = 0, append = false) => {
        if (!user?.tenantId) return;

        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }

        try {
            const params = new URLSearchParams({ page: pageNum, size: 20 });
            if (searchTerm) params.append('keyword', searchTerm);
            if (assetStateFilter) params.append('assetState', assetStateFilter);
            if (startDate) params.append('createdFrom', new Date(startDate).toISOString());
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                params.append('createdTo', end.toISOString());
            }

            const data = await fetchWithAuth(`/products/tenant/passports?${params.toString()}`);
            const allProducts = data?.content || [];
            // 개인 소유(ownerId가 존재)로 넘어간 항목은 브랜드 제품 관리 목록에서 제외
            const newProducts = allProducts.filter((item) => !item.ownerId);

            if (append) {
                setProducts(prev => [...prev, ...newProducts]);
            } else {
                setProducts(newProducts);
            }

            // Check if there are more pages
            setHasMore(!data?.last);
            setTotalElements(data?.totalElements || 0);
            setPage(pageNum);
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts(0, false); // Always fetch first page when filters change
        }, 300); // Debounce search and filter
        return () => clearTimeout(timer);
    }, [user?.tenantId, searchTerm, assetStateFilter, startDate, endDate]);

    // Intersection Observer for infinite scrolling
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
                    fetchProducts(page + 1, true);
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [hasMore, loading, loadingMore, page, searchTerm, assetStateFilter, startDate, endDate]); // Add dependencies for re-observing when filters change

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

    const handleVoidSubmit = async (e) => {
        e.preventDefault();
        try {
            await fetchWithAuth(`/products/passports/${selectedPassportId}/void`, {
                method: 'POST',
                body: JSON.stringify(voidForm)
            });
            alert('제품이 무효화(VOID) 처리되었습니다.');
            setIsVoidModalOpen(false);
            setVoidForm({ reason: 'COUNTERFEIT_DETECTED', note: '' });
            fetchProducts();
        } catch (error) {
            console.error(error);
            alert(`무효화 실패: ${error.message}`);
        }
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
                    <select
                        value={assetStateFilter}
                        onChange={(e) => setAssetStateFilter(e.target.value)}
                        className="bg-gray-50 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-bold border-none outline-none cursor-pointer focus:ring-2 focus:ring-indigo-100"
                    >
                        <option value="">모든 상태</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="VOIDED">VOIDED</option>
                    </select>
                    <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-100 border border-transparent">
                        <Calendar size={16} className="text-gray-400 shrink-0" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-sm text-gray-600 outline-none p-0 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-gray-400 mx-1 text-xs">~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-sm text-gray-600 outline-none p-0 focus:ring-0 cursor-pointer"
                        />
                    </div>
                    <div className="bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center">
                        총 {totalElements}건
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제품 정보</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">DPP ID</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">발행일</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">상태</th>
                            {hasVoidPermission && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">관리</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={hasVoidPermission ? "5" : "4"} className="px-6 py-12 text-center text-gray-400">데이터를 불러오는 중입니다...</td>
                            </tr>
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={hasVoidPermission ? "5" : "4"} className="px-6 py-12 text-center text-gray-400">
                                    <Package size={32} className="mx-auto mb-3 opacity-50" />
                                    발행된 제품 내역이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            products.map((p) => (
                                <tr key={p.passportId} className="hover:bg-gray-50 transition-colors group">
                                    <td
                                        className="px-6 py-4 cursor-pointer"
                                        onClick={() => navigate(`/brand/products/${p.passportId}`)}
                                    >
                                        <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{p.modelName}</div>
                                        <div className="text-xs text-gray-500 mt-1 uppercase tracking-tight">{p.serialNumber}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[11px] font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block mb-1">P: {p.passportId ? p.passportId.substring(0, 16) + '...' : '-'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-700">
                                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusTheme(p.assetState)}`}>
                                            {p.assetState}
                                        </span>
                                    </td>
                                    {hasVoidPermission && (
                                        <td className="px-6 py-4 text-right">
                                            {p.assetState === 'ACTIVE' && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedPassportId(p.passportId);
                                                        setIsVoidModalOpen(true);
                                                    }}
                                                    className="px-3 py-1 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors cursor-pointer inline-flex items-center justify-center"
                                                >
                                                    무효화 (Void)
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Infinite Scroll trigger point & loader */}
                {!loading && (
                    <div ref={observerTarget} className="flex justify-center py-6 border-t border-gray-50">
                        {loadingMore && (
                            <div className="flex items-center gap-2 text-gray-400">
                                <Loader2 size={16} className="animate-spin" />
                                <span className="text-sm font-medium">데이터를 불러오는 중...</span>
                            </div>
                        )}
                        {!hasMore && products.length > 0 && (
                            <span className="text-sm font-medium text-gray-400">모든 제품을 불러왔습니다.</span>
                        )}
                    </div>
                )}
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

            {/* Void Modal */}
            {isVoidModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                                <AlertCircle size={24} />
                                제품 무효화 (Void Asset)
                            </h2>
                            <button
                                onClick={() => setIsVoidModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleVoidSubmit} className="p-6">
                            <div className="space-y-4">
                                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm mb-4 border border-red-100">
                                    <span className="font-bold border-b border-red-200 pb-1 mb-2 block">주의: 이는 영구적인 조치입니다!</span>
                                    이 작업은 선택된 제품(DPP)의 상태를 영구적으로 무효화(VOIDED) 처리합니다.
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        무효화 사유 (Reason) *
                                    </label>
                                    <select
                                        name="reason"
                                        required
                                        value={voidForm.reason}
                                        onChange={(e) => setVoidForm({ ...voidForm, reason: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-colors"
                                    >
                                        <option value="COUNTERFEIT_DETECTED">위조품 발견 (Counterfeit)</option>
                                        <option value="LEGAL_ISSUE">법적 문제 (Legal Issue)</option>
                                        <option value="MANUFACTURING_DEFECT">제조 결함 (Defect)</option>
                                        <option value="INCORRECT_MINT_DATA">발행 정보 오류 (Incorrect Data)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        추가 메모 (Note)
                                    </label>
                                    <textarea
                                        name="note"
                                        value={voidForm.note}
                                        onChange={(e) => setVoidForm({ ...voidForm, note: e.target.value })}
                                        rows={3}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-red-100 focus:border-red-400 transition-colors resize-none"
                                        placeholder="선택 사항입니다."
                                    />
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsVoidModalOpen(false)}
                                    className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-bold bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
                                >
                                    무효화 실행
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
