import React, { useState, useEffect } from 'react';
import useAuthStore, { ROLES } from '../../store/useAuthStore';
import { User, Shield, FileText, Settings, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MyPage = () => {
  const navigate = useNavigate();
  const { user, myMemberships, myApplications, myAccount, fetchMyMemberships, listMyApplications, fetchMyAccount, updateMyAccount, getApplication, setRole } = useAuthStore();
  const [activeTab, setActiveTab] = useState('membership');
  const [loading, setLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [appDetailLoading, setAppDetailLoading] = useState(false);

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    // Force role to USER when entering MyPage
    // We do this inside the component to avoid race conditions with React Router ProtectedRoute navigation
    if (user && user.role !== ROLES.USER) {
      setRole(ROLES.USER);
    }
  }, [user?.role, setRole]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchMyMemberships(),
        listMyApplications(),
        fetchMyAccount().then(res => {
          if (res.success && res.data) {
            setPhoneInput(res.data.phone || '');
          }
        })
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchMyMemberships, listMyApplications, fetchMyAccount]);

  const handlePhoneUpdate = async () => {
    if (!phoneInput || isUpdatingPhone) return;
    setIsUpdatingPhone(true);
    const result = await updateMyAccount({ phone: phoneInput });
    if (!result.success) {
      alert(result.message || '전화번호 변경에 실패했습니다.');
    } else {
      alert('전화번호가 성공적으로 변경되었습니다.');
    }
    setIsUpdatingPhone(false);
  };

  const handleAppClick = async (appId) => {
    setAppDetailLoading(true);
    const result = await getApplication(appId);
    if (result.success && result.data) {
      setSelectedApp(result.data);
    } else {
      alert(result.message || '신청 상세 정보를 불러오는데 실패했습니다.');
    }
    setAppDetailLoading(false);
  };

  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || isUpdatingPassword) return;
    setIsUpdatingPassword(true);
    const result = await updateMyAccount({ currentPassword, newPassword });
    if (!result.success) {
      alert(result.message || '비밀번호 변경에 실패했습니다.');
    } else {
      alert('비밀번호가 성공적으로 변경되었습니다.');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
    }
    setIsUpdatingPassword(false);
  };

  const tabs = [
    { id: 'membership', label: '소속/권한 관리', icon: <Shield size={18} /> },
    { id: 'account', label: '나의 계정 관리', icon: <Settings size={18} /> },
    { id: 'applications', label: '나의 신청 현황', icon: <FileText size={18} /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header Section */}
      <div className="flex items-center gap-6 mb-10">
        <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
          <User size={36} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{myAccount?.email || user?.email || '사용자'}님, 안녕하세요.</h1>
          <p className="text-gray-500 mt-2 text-lg">디지털 제품 여권 생태계의 여정을 확인하세요.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="md:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${activeTab === tab.id
                  ? 'bg-gray-50 text-gray-900 font-semibold border-l-4 border-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                  }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className={`${activeTab === tab.id ? 'text-gray-900' : 'text-gray-400'}`}>
                  {tab.icon}
                </div>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'membership' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Shield className="text-blue-600" />
                소속/권한 관리
              </h2>
              {loading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
              ) : myMemberships?.length > 0 ? (
                <div className="space-y-4">
                  {myMemberships.map((membership) => (
                    <div key={membership.membershipId} className="p-5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold text-gray-800">{membership.tenantName || '이름 없음'} <span className="text-sm font-normal text-gray-500 ml-2">({membership.groupType || '알 수 없음'})</span></div>
                        <div className="text-sm text-gray-500 mt-1">
                          역할: {membership.roleCodes?.join(', ') || '없음'}
                        </div>
                      </div>
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${membership.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {membership.status === 'ACTIVE' ? '활성화' : membership.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-100">
                  <Shield size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">가입된 그룹(기업/테넌트)이 없습니다.</h3>
                  <p className="text-gray-500 text-sm mb-6">
                    현재 일반 사용자 계정입니다.<br />
                    제품 인증서나 이벤트를 조회하는 등 일반적인 기능은 정상 이용 가능합니다.<br />
                    만약 기업 고객이시라면 업체 신청을 통해 그룹 멤버로 합류할 수 있습니다.
                  </p>
                  <button
                    onClick={() => navigate('/onboarding')}
                    className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    업체 신청하러 가기
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'account' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Settings className="text-gray-600" />
                  나의 계정 관리
                </h2>
                {myAccount?.status === 'ACTIVE' && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full border border-green-200">활성화 됨</span>
                )}
              </div>
              <div className="space-y-8">
                {/* Read-only Information */}
                <div>
                  <h3 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">기본 정보</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">사용자 ID</label>
                      <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-200 text-gray-500 font-medium break-all cursor-not-allowed">
                        {myAccount?.userId || user?.id || '정보 없음'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">이메일</label>
                      <div className="px-4 py-3 bg-gray-100 rounded-lg border border-gray-200 text-gray-500 font-medium break-all cursor-not-allowed">
                        {myAccount?.email || user?.email || '정보 없음'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Editable Information */}
                <div>
                  <h3 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">연락처 및 보안</h3>
                  <div className="grid grid-cols-1 gap-6 max-w-lg">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">전화번호</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="flex-1 px-4 py-2 bg-white rounded-lg border border-gray-300 text-gray-900 font-medium focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                          placeholder="010-0000-0000"
                        />
                        <button
                          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
                          onClick={handlePhoneUpdate}
                          disabled={isUpdatingPhone || phoneInput === myAccount?.phone}
                        >
                          {isUpdatingPhone ? '저장 중...' : '변경 저장'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                      <label className="text-sm font-medium text-gray-700">비밀번호 변경</label>
                      {!isChangingPassword ? (
                        <button
                          className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                          onClick={() => setIsChangingPassword(true)}
                        >
                          <Shield size={16} /> 안전하게 비밀번호 변경하기
                        </button>
                      ) : (
                        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="현재 비밀번호 입력"
                            className="w-full px-4 py-2 bg-white rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900 outline-none"
                          />
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="새 비밀번호 입력 (대문자 포함 8자 이상)"
                            className="w-full px-4 py-2 bg-white rounded-lg border border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900 outline-none"
                          />
                          <div className="flex gap-2 pt-2">
                            <button
                              className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                              onClick={handlePasswordUpdate}
                              disabled={isUpdatingPassword || !currentPassword || !newPassword}
                            >
                              {isUpdatingPassword ? '저장 중...' : '비밀번호 변경 적용'}
                            </button>
                            <button
                              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                              onClick={() => {
                                setIsChangingPassword(false);
                                setCurrentPassword('');
                                setNewPassword('');
                              }}
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <FileText className="text-indigo-600" />
                나의 신청 현황
              </h2>
              {loading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
              ) : myApplications?.length > 0 ? (
                <div className="space-y-4">
                  {myApplications.map((app) => (
                    <div
                      key={app.applicationId}
                      className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between cursor-pointer hover:bg-indigo-50 transition-colors"
                      onClick={() => handleAppClick(app.applicationId)}
                    >
                      <div>
                        <div className="text-lg font-bold text-gray-800">{app.orgName} <span className="text-sm font-normal text-gray-500 ml-2">({app.type})</span></div>
                        <div className="text-sm text-gray-500 mt-1">사업자 등록번호: {app.bizRegNo} | 국가: {app.country}</div>
                        {app.rejectReason && <div className="text-sm text-red-500 mt-1 font-medium">반려 사유: {app.rejectReason}</div>}
                      </div>
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${app.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        app.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                        {app.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-indigo-50/50 rounded-xl p-8 text-center border border-indigo-100">
                  <FileText size={48} className="mx-auto text-indigo-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">진행 중인 신청이 없습니다</h3>
                  <p className="text-gray-500">새로운 온보딩 신청 내역이 없습니다.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Application Detail Modal */}
      {appDetailLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Loader2 className="animate-spin text-white" size={48} />
        </div>
      )}

      {selectedApp && !appDetailLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="text-indigo-600" />
                신청 상세 정보
              </h3>
              <button onClick={() => setSelectedApp(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-y-5 gap-x-6 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">신청 기관명</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedApp.orgName}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">신청 타입</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedApp.type}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">국가</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedApp.country}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">사업자 등록번호</div>
                  <div className="font-semibold text-gray-900 text-base">{selectedApp.bizRegNo}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 mb-1">증빙 자료 파일</div>
                  {selectedApp.evidenceOriginalFileName ? (
                    <a
                      href={selectedApp.evidenceDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                    >
                      <FileText size={16} />
                      {selectedApp.evidenceOriginalFileName}
                    </a>
                  ) : <div className="text-gray-500">첨부 파일 없음</div>}
                </div>
                <div>
                  <div className="text-gray-500 mb-1">상태</div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${selectedApp.status === 'APPROVED' ? 'bg-green-100 text-green-700' : selectedApp.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {selectedApp.status}
                  </span>
                </div>
              </div>

              {selectedApp.rejectReason && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 mt-4">
                  <div className="text-red-700 font-semibold mb-1 text-sm">반려 사유</div>
                  <div className="text-red-600 text-sm whitespace-pre-wrap">{selectedApp.rejectReason}</div>
                </div>
              )}
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedApp(null)}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPage;
