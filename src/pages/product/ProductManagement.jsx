import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Calendar, Filter, Download, Plus, FileDigit, Database, Factory, Hash, Code, Loader2, X, UploadCloud, FileText, AlertCircle } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { apiFetchJson } from '../../utils/api';
import { PERMISSION_GUIDES, createHttpError, getCurrentMembership, hasEffectiveScope, normalizeApiErrorMessage, toPermissionMessage } from '../../utils/permissionUi';

// Role-based utility to fetch with Auth Token
const fetchWithAuth = async (url, options = {}) => {
    const token = useAuthStore.getState().accessToken;
    return apiFetchJson(url, options, {
        token,
        fallbackMessage: normalizeApiErrorMessage('', undefined)
    });
};

const ProductManagement = () => {
    const navigate = useNavigate();
    const { user, myMemberships } = useAuthStore();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [assetStateFilter, setAssetStateFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Pagination/Infinite Scroll states
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isMobileView, setIsMobileView] = useState(() => window.innerWidth < 768);
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

    const currentMembership = getCurrentMembership(myMemberships, user?.tenantId, 'BRAND');

    // DPP 발행(Mint) 버튼 노출 조건:
    // 오직 현재 로그인한 tenant membership의 effectiveScopes에 BRAND_MINT가 존재할 때만 허용
    const hasMintPermission = hasEffectiveScope(currentMembership, 'BRAND_MINT');

    // Void 버튼 노출 조건: BRAND_VOID 스코프
    const hasVoidPermission = hasEffectiveScope(currentMembership, 'BRAND_VOID');

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 767px)');
        const handleChange = (event) => setIsMobileView(event.matches);
        setIsMobileView(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const fetchProducts = async (pageNum = 0, append = false) => {
        if (!user?.tenantId) return;

        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            setError('');
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
            setTotalPages(data?.totalPages || 0);
            setPage(pageNum);
        } catch (error) {
            console.error("Failed to fetch products:", error);
            setProducts([]);
            setHasMore(false);
            setTotalElements(0);
            setTotalPages(0);
            setError(toPermissionMessage(error, 'DEFAULT', '제품 목록을 불러오지 못했습니다.'));
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setHasLoadedOnce(true);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts(0, false); // Always fetch first page when filters change
        }, 300); // Debounce search and filter
        return () => clearTimeout(timer);
    }, [user?.tenantId, searchTerm, assetStateFilter, startDate, endDate, isMobileView]);

    // Intersection Observer for infinite scrolling
    useEffect(() => {
        if (!isMobileView) return undefined;

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
    }, [hasMore, isMobileView, loading, loadingMore, page, searchTerm, assetStateFilter, startDate, endDate]); // Add dependencies for re-observing when filters change

    const visiblePageNumbers = (() => {
        if (totalPages <= 1) return [];
        const start = Math.max(0, page - 2);
        const end = Math.min(totalPages, start + 5);
        return Array.from({ length: end - start }, (_, idx) => start + idx);
    })();

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
            alert(`DPP 발행 실패: ${toPermissionMessage(error, 'BRAND_MINT', 'DPP 발행에 실패했습니다.')}`);
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
            alert(`무효화 실패: ${toPermissionMessage(error, 'DEFAULT', '제품 무효화에 실패했습니다.')}`);
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

    const showInitialLoading = loading && !hasLoadedOnce;
    const showRefreshing = loading && hasLoadedOnce && !loadingMore;

    return (
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
            {/* Header Section */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h1 className="flex flex-wrap items-center gap-3 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                        <Package className="text-indigo-600" size={32} />
                        제품 관리 (Product Passports)
                    </h1>
                    <p className="mt-2 text-sm font-medium leading-6 text-gray-500 sm:text-base">
                        테넌트에서 발행된 모든 제품(Passport) 목록을 조회합니다.
                    </p>
                </div>
                <div className="flex w-full gap-3 sm:w-auto">
                    {hasMintPermission && (
                        <button
                            type="button"
                            onClick={() => setIsMintModalOpen(true)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 sm:w-auto sm:py-2 cursor-pointer"
                        >
                            <Plus size={16} />
                            DPP 발행 (Mint)
                        </button>
                    )}
                </div>
            </div>

            {!hasMintPermission && (
                <div className="mb-4 text-sm text-gray-500">
                    DPP 발행은 브랜드 발행 권한이 있는 멤버만 사용할 수 있습니다.
                </div>
            )}

            {error && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {error}
                </div>
            )}

            {/* Config & Filters */}
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:gap-4">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="모델명 또는 시리얼 번호 검색..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 transition-shadow"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <select
                        value={assetStateFilter}
                        onChange={(e) => setAssetStateFilter(e.target.value)}
                        className="w-full rounded-xl border-none bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-100 sm:w-auto cursor-pointer"
                    >
                        <option value="">모든 상태</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="VOIDED">VOIDED</option>
                    </select>
                    <div className="flex flex-col gap-2 rounded-xl border border-transparent bg-gray-50 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-100 sm:flex-row sm:items-center sm:gap-1 sm:py-1.5">
                        <Calendar size={16} className="text-gray-400 shrink-0" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-sm text-gray-600 outline-none p-0 focus:ring-0 cursor-pointer"
                        />
                        <span className="mx-1 text-xs text-gray-400">~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-sm text-gray-600 outline-none p-0 focus:ring-0 cursor-pointer"
                        />
                    </div>
                    <div className="flex items-center justify-center rounded-xl bg-gray-50 px-4 py-2 text-sm font-bold text-gray-600 sm:ml-auto">
                        총 {totalElements}건
                    </div>
                </div>
                {showRefreshing && (
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                        <Loader2 size={16} className="animate-spin" />
                        목록을 업데이트하는 중입니다...
                    </div>
                )}
            </div>

            {/* Main Table */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="md:hidden">
                    {showInitialLoading ? (
                        <div className="px-6 py-12 text-center text-gray-400">데이터를 불러오는 중입니다...</div>
                    ) : products.length === 0 ? (
                        <div className="px-6 py-12 text-center text-gray-400">
                            <Package size={32} className="mx-auto mb-3 opacity-50" />
                            발행된 제품 내역이 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-3 p-3">
                            {products.map((p) => (
                                <div key={p.passportId} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/brand/products/${p.passportId}`)}
                                        className="w-full text-left"
                                    >
                                        <div className="text-base font-bold text-gray-900">{p.modelName}</div>
                                        <div className="mt-1 text-xs uppercase tracking-tight text-gray-500">{p.serialNumber}</div>
                                    </button>
                                    <div className="mt-4 space-y-3 text-sm">
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">DPP ID</div>
                                            <div className="mt-1 break-all font-mono text-[12px] text-gray-600">{p.passportId || '-'}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">발행일</div>
                                                <div className="mt-1 text-gray-700">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">상태</div>
                                                <div className="mt-1">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusTheme(p.assetState)}`}>
                                                        {p.assetState}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/brand/products/${p.passportId}`)}
                                            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700"
                                        >
                                            상세보기
                                        </button>
                                        {p.assetState === 'ACTIVE' && hasVoidPermission && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedPassportId(p.passportId);
                                                    setIsVoidModalOpen(true);
                                                }}
                                                className="inline-flex w-full items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600"
                                            >
                                                무효화 (Void)
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[860px] w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제품 정보</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">DPP ID</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">발행일</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">상태</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {showInitialLoading ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-gray-400">데이터를 불러오는 중입니다...</td>
                            </tr>
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
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
                                    <td className="px-6 py-4 text-right">
                                        {p.assetState === 'ACTIVE' && hasVoidPermission ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedPassportId(p.passportId);
                                                    setIsVoidModalOpen(true);
                                                }}
                                                className="px-3 py-1 rounded-lg text-xs font-bold transition-colors inline-flex items-center justify-center bg-white border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                                            >
                                                무효화 (Void)
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-300">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>

                {/* Infinite Scroll trigger point & loader */}
                {!showInitialLoading && isMobileView && (
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

                {!showInitialLoading && !isMobileView && totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-50 px-4 py-4">
                        <div className="text-sm text-gray-500">
                            페이지 {page + 1} / {totalPages}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fetchProducts(page - 1, false)}
                                disabled={page === 0}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                이전
                            </button>
                            {visiblePageNumbers.map((pageNumber) => (
                                <button
                                    key={pageNumber}
                                    type="button"
                                    onClick={() => fetchProducts(pageNumber, false)}
                                    className={`min-w-10 rounded-lg px-3 py-2 text-sm font-semibold ${
                                        pageNumber === page
                                            ? 'bg-indigo-600 text-white'
                                            : 'border border-gray-200 text-gray-600'
                                    }`}
                                >
                                    {pageNumber + 1}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => fetchProducts(page + 1, false)}
                                disabled={page >= totalPages - 1}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                다음
                            </button>
                        </div>
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
