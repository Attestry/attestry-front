import React from 'react';

const TransferReceiveView = () => {
  return (
    <div className="max-w-4xl mx-auto py-16 px-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">디지털 자산 이전 받기</h1>
        <p className="text-gray-600 mt-3">
          이전 코드/QR 기반 자산 이전 수락 화면은 다음 단계에서 연결됩니다.
        </p>
        <p className="text-sm text-gray-500 mt-6">
          현재는 디지털 자산 등록하기(구매 클레임) 기능을 우선 적용했습니다.
        </p>
      </div>
    </div>
  );
};

export default TransferReceiveView;
