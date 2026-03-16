import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore, { ROLES } from '../../store/useAuthStore';
import { Building2, CheckCircle, ChevronRight, FileStack, Store, Wrench } from 'lucide-react';

const TYPE_OPTIONS = [
  { id: ROLES.BRAND, title: '제조 업체 (Brand)', desc: '제품을 직접 생산하고 디지털 여권을 신규 발행합니다.', icon: Building2, tone: 'from-[#eef3ff] to-[#f9fbff] border-[#d9e4ff] text-[#2248a8]' },
  { id: ROLES.RETAIL, title: '판매처 (Retail)', desc: '제품에 대한 권한을 부여받아 소비자에게 판매 및 소유권을 이전합니다.', icon: Store, tone: 'from-[#eef8f1] to-[#fbfefc] border-[#d7eadf] text-[#2f6d4f]' },
  { id: ROLES.SERVICE, title: '서비스 업체 (Service)', desc: '제품의 수리, 세탁 등 사후 관리를 제공합니다.', icon: Wrench, tone: 'from-[#fff5ea] to-[#fffdf9] border-[#f2dcc1] text-[#9a6227]' },
];

const STEPS = ['유형 선택', '정보 입력', '신청 완료'];

const OnboardingView = () => {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    orgName: '',
    bizRegNo: '',
    country: 'KR',
    address: '',
  });

  const { submitApplication, presignEvidence, completeEvidenceUpload, error } = useAuthStore();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const handleRemoveFile = (indexToRemove) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
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

      for (const fileItem of files) {
        const presignRes = await presignEvidence(fileItem.name, fileItem.type || 'application/octet-stream', currentBundleId);
        if (!presignRes.success) throw new Error(presignRes.message);

        const { uploadUrl, evidenceBundleId, evidenceFileId } = presignRes.data;
        currentBundleId = evidenceBundleId;

        uploadTasks.push({
          fileItem,
          uploadUrl,
          evidenceBundleId,
          evidenceFileId,
        });
      }

      for (const task of uploadTasks) {
        const uploadRes = await fetch(task.uploadUrl, {
          method: 'PUT',
          body: task.fileItem,
          headers: { 'Content-Type': task.fileItem.type || 'application/octet-stream' },
        });
        if (!uploadRes.ok) throw new Error(`파일 업로드에 실패했습니다: ${task.fileItem.name}`);

        const completeRes = await completeEvidenceUpload(task.evidenceBundleId, task.evidenceFileId, task.fileItem.size);
        if (!completeRes.success) throw new Error(completeRes.message);
      }

      const submitRes = await submitApplication({
        type: selectedType,
        ...formData,
        evidenceBundleId: currentBundleId,
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
    <div className="tracera-page-shell min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="tracera-page-hero">
          <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div>
              <div className="tracera-page-tag">
                <FileStack size={14} />
                PARTNER ONBOARDING
              </div>
              <h1 className="tracera-keepall mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-[2.9rem]">
                운영 파트너 신청을
                <span className="block text-slate-600">같은 서비스 톤으로 정리합니다</span>
              </h1>
              <p className="tracera-keepall mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[0.98rem]">
                브랜드, 리테일, 서비스 업체 신청 흐름을 단정한 단계 구조로 구성했습니다. 필요한 증빙과 기본 정보만 채우면 심사 흐름으로 바로 이어집니다.
              </p>
            </div>

            <div className="tracera-page-card-soft p-5">
              <div className="text-sm font-semibold tracking-[0.18em] text-slate-500">신청 단계</div>
              <div className="mt-4 space-y-3">
                {STEPS.map((label, index) => {
                  const current = index + 1;
                  const completed = step > current;
                  const active = step === current;
                  return (
                    <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${completed || active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {completed ? <CheckCircle size={16} /> : current}
                      </div>
                      <div className={`text-sm font-semibold ${active ? 'text-slate-950' : 'text-slate-500'}`}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6">
          {step === 1 && (
            <section className="tracera-page-card p-5 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-sm font-semibold tracking-[0.18em] text-slate-500">Step 01</div>
                  <h2 className="mt-2 whitespace-nowrap text-2xl font-semibold tracking-[-0.04em] text-slate-950">어떤 유형의 파트너십을 원하시나요?</h2>
                </div>
                <div className="whitespace-nowrap text-sm leading-6 text-slate-500">원하는 운영 역할을 선택하면 다음 단계에서 필요한 입력만 보여줍니다.</div>
              </div>

              <div className="mt-6 grid gap-4">
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedType(option.id)}
                    className={`rounded-[1.6rem] border bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-40px_rgba(15,23,42,0.24)] ${selectedType === option.id ? 'border-slate-900 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.34)] ring-1 ring-slate-900/10' : 'border-slate-200'} sm:p-6`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border bg-gradient-to-br ${option.tone}`}>
                        <option.icon size={26} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{option.title}</h3>
                        <p className="mt-2 whitespace-nowrap text-sm leading-7 text-slate-600">{option.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  disabled={!selectedType}
                  onClick={() => setStep(2)}
                  className="tracera-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  다음 단계로
                  <ChevronRight size={15} />
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="tracera-page-card p-5 sm:p-6 lg:p-7">
              <div className="tracera-page-toolbar gap-3">
                <div>
                  <div className="text-sm font-semibold tracking-[0.18em] text-slate-500">Step 02</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">기업 정보와 증빙 자료 입력</h2>
                </div>
                <span className="tracera-page-pill">
                  {TYPE_OPTIONS.find((t) => t.id === selectedType)?.title}
                </span>
              </div>

              {error && (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-2 block font-medium text-slate-700">상호명 (Company Name)</span>
                    <input required type="text" name="orgName" value={formData.orgName} onChange={handleInputChange} className="tracera-workflow-field" placeholder="(주)애터스트리" />
                  </label>

                  <label className="text-sm">
                    <span className="mb-2 block font-medium text-slate-700">사업자 등록번호</span>
                    <input required type="text" name="bizRegNo" value={formData.bizRegNo} onChange={handleInputChange} className="tracera-workflow-field" placeholder="123-45-67890" />
                  </label>

                  <label className="text-sm">
                    <span className="mb-2 block font-medium text-slate-700">국가 (Country)</span>
                    <select name="country" value={formData.country} onChange={handleInputChange} className="tracera-workflow-field">
                      <option value="KR">대한민국 (KR)</option>
                      <option value="US">미국 (US)</option>
                      <option value="JP">일본 (JP)</option>
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="mb-2 block font-medium text-slate-700">
                      주소 (Address)
                      {selectedType === ROLES.SERVICE && <span className="ml-1 text-rose-500">*</span>}
                    </span>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required={selectedType === ROLES.SERVICE}
                      className="tracera-workflow-field"
                      placeholder={selectedType === ROLES.SERVICE ? '서비스 업체 운영 주소를 입력하세요.' : '선택 입력'}
                    />
                    {selectedType === ROLES.SERVICE && (
                      <p className="mt-2 text-xs text-slate-500">서비스 업체는 주소가 승인 후 tenant 정보로 바로 반영됩니다.</p>
                    )}
                  </label>
                </div>

                <div className="tracera-page-card-soft p-4 sm:p-5">
                  <div className="text-sm font-semibold tracking-[-0.02em] text-slate-900">증빙 서류 업로드</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">사업자등록증 등 심사에 필요한 파일을 첨부하세요. PDF, JPG, PNG 형식을 지원합니다.</p>

                  <div className="mt-4 flex flex-col gap-2">
                    <label className="flex cursor-pointer items-center justify-center rounded-[1.4rem] border border-dashed border-slate-300 bg-white px-4 py-5 text-center transition hover:border-slate-500 hover:bg-slate-50">
                      <span className="text-sm font-semibold text-slate-700">파일 첨부하기</span>
                      <input required={files.length === 0} type="file" multiple onChange={handleFileChange} className="sr-only" accept=".pdf,.jpg,.jpeg,.png" />
                    </label>
                    <p className="text-xs text-slate-500">PDF, JPG, PNG 형식 다중 첨부 지원 (개당 최대 10MB)</p>
                  </div>

                  {files.length > 0 && (
                    <ul className="mt-4 grid gap-3">
                      {files.map((f, idx) => (
                        <li key={idx} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="min-w-0 overflow-hidden">
                            <div className="truncate text-sm font-medium text-slate-900" title={f.name}>{f.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{(f.size / 1024 / 1024).toFixed(2)} MB</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            삭제
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" disabled={loading} onClick={() => setStep(1)} className="tracera-button-secondary disabled:opacity-50">
                    이전 단계
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="tracera-button-primary disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        처리 중...
                      </>
                    ) : '증빙 자료 제출 및 신청 완료'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {step === 3 && (
            <section className="tracera-page-card p-6 text-center sm:p-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                <CheckCircle size={40} />
              </div>
              <h2 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-slate-950">신청이 접수되었습니다</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
                제출해주신 증빙 자료를 바탕으로 관리자가 승인 심사를 진행합니다. 심사는 영업일 기준 1~3일 정도 소요될 수 있습니다.
              </p>
              <div className="mt-8 flex justify-center">
                <button onClick={() => navigate('/')} className="tracera-button-primary">
                  메인으로 돌아가기
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingView;
