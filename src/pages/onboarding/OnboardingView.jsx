import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore, { ROLES } from '../../store/useAuthStore';
import { Building2, Store, Wrench, CheckCircle } from 'lucide-react';

const TYPE_OPTIONS = [
    { id: ROLES.BRAND, title: '제조 업체 (Brand)', desc: '제품을 직접 생산하고 디지털 여권을 신규 발행합니다.', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { id: ROLES.RETAIL, title: '유통 업체 (Retail)', desc: '완제품을 매입하여 소비자에게 판매 및 소유권을 이전합니다.', icon: Store, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    { id: ROLES.SERVICE, title: '서비스 업체 (Service)', desc: '제품의 수리, 세탁, 인증 등의 사후 관리를 제공합니다.', icon: Wrench, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
];

const OnboardingView = () => {
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        orgName: '',
        bizRegNo: '',
        country: 'KR',
        address: ''
    });

    const { submitApplication, presignEvidence, completeEvidenceUpload, error } = useAuthStore();
    const navigate = useNavigate();

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(prev => [...prev, ...Array.from(e.target.files)]);
        }
    };

    const handleRemoveFile = (indexToRemove) => {
        setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selectedType === ROLES.SERVICE && !formData.address.trim()) {
            alert('서비스 업체 신청은 주소를 반드시 입력해야 합니다.');
            return;
        }
        if (files.length === 0) {
            alert('최소 1개 이상의 증빙 서류를 업로드해주세요.');
            return;
        }

        setLoading(true);
        try {
            let currentBundleId = null;
            const uploadTasks = [];

            // 1. Register all files first (Presign)
            // This ensures the bundle knows about all files before any are marked 'complete'
            for (const fileItem of files) {
                const presignRes = await presignEvidence(fileItem.name, fileItem.type || 'application/octet-stream', currentBundleId);
                if (!presignRes.success) throw new Error(presignRes.message);

                const { uploadUrl, evidenceBundleId, evidenceFileId } = presignRes.data;
                currentBundleId = evidenceBundleId; // Reuse the bundle ID for subsequent files

                uploadTasks.push({
                    fileItem,
                    uploadUrl,
                    evidenceBundleId,
                    evidenceFileId
                });
            }

            // 2. Upload and Complete each file
            for (const task of uploadTasks) {
                // Upload to S3
                const uploadRes = await fetch(task.uploadUrl, {
                    method: 'PUT',
                    body: task.fileItem,
                    headers: { 'Content-Type': task.fileItem.type || 'application/octet-stream' }
                });
                if (!uploadRes.ok) throw new Error(`파일 업로드에 실패했습니다: ${task.fileItem.name}`);

                // Complete
                const completeRes = await completeEvidenceUpload(task.evidenceBundleId, task.evidenceFileId, task.fileItem.size);
                if (!completeRes.success) throw new Error(completeRes.message);
            }

            // 3. Submit Application
            const submitRes = await submitApplication({
                type: selectedType,
                ...formData,
                evidenceBundleId: currentBundleId
            });

            if (submitRes.success) {
                setStep(3);
            } else {
                throw new Error(submitRes.message);
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-12 px-6 animate-in fade-in duration-500">

            {/* Step Progress */}
            <div className="mb-12">
                <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">업체 파트너 신청</h1>
                <div className="flex items-center justify-center gap-4">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= 1 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
                    <div className={`h-1 w-16 bg-gray-200 rounded`}>
                        <div className={`h-full bg-gray-900 transition-all ${step >= 2 ? 'w-full' : 'w-0'}`}></div>
                    </div>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= 2 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                    <div className={`h-1 w-16 bg-gray-200 rounded`}>
                        <div className={`h-full bg-gray-900 transition-all ${step >= 3 ? 'w-full' : 'w-0'}`}></div>
                    </div>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= 3 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}><CheckCircle size={16} /></div>
                </div>
                <div className="flex justify-center gap-10 mt-2 text-xs font-medium text-gray-500">
                    <span className={step >= 1 ? 'text-gray-900' : ''}>유형 선택</span>
                    <span className={step >= 2 ? 'text-gray-900' : ''}>정보 입력</span>
                    <span className={step >= 3 ? 'text-gray-900' : ''}>신청 완료</span>
                </div>
            </div>

            {step === 1 && (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">어떤 유형의 파트너십을 원하시나요?</h2>
                    <div className="grid gap-4">
                        {TYPE_OPTIONS.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => setSelectedType(option.id)}
                                className={`flex items-start p-6 rounded-xl border-2 text-left transition-all ${selectedType === option.id
                                    ? `border-gray-900 bg-gray-50 shadow-sm ring-1 ring-gray-900`
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`p-4 rounded-lg mr-6 ${option.bg} ${option.color}`}>
                                    <option.icon size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{option.title}</h3>
                                    <p className="text-gray-600 text-sm">{option.desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button
                            disabled={!selectedType}
                            onClick={() => setStep(2)}
                            className="bg-gray-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            다음 단계로
                        </button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="bg-white p-8 border border-gray-200 rounded-2xl shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900">기업 정보 입력</h2>
                        <span className="text-sm font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                            {TYPE_OPTIONS.find(t => t.id === selectedType)?.title}
                        </span>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">상호명 (Company Name)</label>
                            <input required type="text" name="orgName" value={formData.orgName} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="(주)애터스트리" />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">사업자 등록번호</label>
                            <input required type="text" name="bizRegNo" value={formData.bizRegNo} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="123-45-67890" />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">국가 (Country)</label>
                            <select name="country" value={formData.country} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900">
                                <option value="KR">대한민국 (KR)</option>
                                <option value="US">미국 (US)</option>
                                <option value="JP">일본 (JP)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                주소 (Address)
                                {selectedType === ROLES.SERVICE && <span className="ml-1 text-rose-500">*</span>}
                            </label>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                required={selectedType === ROLES.SERVICE}
                                className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                placeholder={selectedType === ROLES.SERVICE ? '서비스 업체 운영 주소를 입력하세요.' : '선택 입력'}
                            />
                            {selectedType === ROLES.SERVICE && (
                                <p className="mt-1 text-xs text-gray-500">서비스 업체는 주소가 승인 후 tenant 정보로 바로 반영됩니다.</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">증빙 서류 (사업자등록증 등)</label>

                            <div className="mt-1 flex flex-col gap-2">
                                <label className="flex items-center justify-center w-full bg-gray-50 border border-gray-300 border-dashed rounded-md px-4 py-4 cursor-pointer hover:border-gray-900 transition-colors">
                                    <span className="text-sm font-medium text-gray-600">파일 첨부하기 (클릭)</span>
                                    <input required={files.length === 0} type="file" multiple onChange={handleFileChange} className="sr-only" accept=".pdf,.jpg,.jpeg,.png" />
                                </label>
                                <p className="text-xs text-gray-500">PDF, JPG, PNG 형식 다중 첨부 지원 (개당 최대 10MB)</p>
                            </div>

                            {files.length > 0 && (
                                <ul className="mt-4 space-y-2">
                                    {files.map((f, idx) => (
                                        <li key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md">
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-sm font-medium text-gray-900 truncate" title={f.name}>{f.name}</span>
                                                <span className="text-xs text-gray-500">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFile(idx)}
                                                className="text-gray-400 hover:text-red-500 font-bold px-2 py-1 text-xs"
                                            >
                                                삭제
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="pt-4 mt-6 border-t border-gray-100 flex justify-between">
                            <button type="button" disabled={loading} onClick={() => setStep(1)} className="text-gray-600 font-medium px-4 py-2 hover:bg-gray-50 rounded-md disabled:opacity-50">이전 단계</button>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`bg-gray-900 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2`}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        처리 중...
                                    </>
                                ) : '증빙 자료 제출 및 신청 완료'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {step === 3 && (
                <div className="text-center bg-white p-12 border border-gray-200 rounded-2xl shadow-sm">
                    <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">신청이 접수되었습니다!</h2>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                        제출해주신 증빙 자료를 바탕으로 관리자가 승인 심사를 진행합니다. 심사는 영업일 기준 1~3일 소요될 수 있습니다.
                    </p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => navigate('/')} className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-800">
                            메인으로 돌아가기
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default OnboardingView;
