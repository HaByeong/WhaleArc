import LegalPageLayout from '../components/LegalPageLayout';

const PrivacyPage = () => {
  return (
    <LegalPageLayout title="개인정보처리방침" updatedDate="2026년 4월 8일">
      <section>
        <p>
          WhaleArc(이하 "서비스")는 개인정보보호법에 따라 이용자의 개인정보를 보호하고, 이와 관련한 고충을
          신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제1조 (수집하는 개인정보 항목 및 수집 방법)</h2>
        <h3 className="font-medium text-whale-dark mb-2">1. 수집 항목</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left font-medium">구분</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-medium">수집 항목</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2">필수 (이메일 가입)</td>
                <td className="border border-gray-200 px-3 py-2">이메일 주소, 닉네임, 비밀번호(해시 처리)</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">필수 (Google OAuth)</td>
                <td className="border border-gray-200 px-3 py-2">이메일 주소, 이름, Google 계정 식별자</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">선택 (프로필 설정)</td>
                <td className="border border-gray-200 px-3 py-2">투자 성향, 투자 경험 수준, 관심 자산, 자기소개</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">선택 (Virt 모드)</td>
                <td className="border border-gray-200 px-3 py-2">거래소 API 키·시크릿 (암호화 저장)</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">서비스 이용 중 생성</td>
                <td className="border border-gray-200 px-3 py-2">모의투자 거래 내역, 포트폴리오 데이터, 가격 알림 설정, 전략 백테스트 기록</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">피드백</td>
                <td className="border border-gray-200 px-3 py-2">피드백 제목·내용·카테고리, 작성자명, 첨부 이미지</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h3 className="font-medium text-whale-dark mb-2">2. 수집 방법</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>회원가입 시 직접 입력</li>
          <li>Google OAuth 인증을 통한 자동 수집</li>
          <li>서비스 이용 과정에서 자동 생성·수집</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제2조 (개인정보의 수집 및 이용 목적)</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>회원 관리:</strong> 회원가입, 본인 확인, 계정 관리, 서비스 부정 이용 방지</li>
          <li><strong>서비스 제공:</strong> 모의투자 기능 제공, 포트폴리오 관리, 수익률 분석, 랭킹 산정</li>
          <li><strong>맞춤 서비스:</strong> 투자 성향에 따른 서비스 최적화</li>
          <li><strong>Virt 모드:</strong> 거래소 API 연동을 통한 실계좌 자산 조회</li>
          <li><strong>서비스 개선:</strong> 피드백 수집 및 서비스 품질 향상</li>
          <li><strong>공지사항 전달:</strong> 서비스 변경 사항, 약관 변경 등 안내</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제3조 (개인정보의 보유 및 이용 기간)</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>회원 탈퇴 시 지체 없이 파기합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</li>
          <li>부정 이용 방지를 위해 탈퇴 후 30일간 식별 정보(해시 처리된 이메일)를 보관할 수 있습니다.</li>
        </ul>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left font-medium">보존 근거</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-medium">보존 기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2">서비스 이용 기록 (전자상거래법)</td>
                <td className="border border-gray-200 px-3 py-2">3년</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">접속 로그 기록 (통신비밀보호법)</td>
                <td className="border border-gray-200 px-3 py-2">3개월</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제4조 (개인정보의 제3자 제공)</h2>
        <p className="mb-3">서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우 예외로 합니다.</p>
        <ul className="list-disc list-inside space-y-2">
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령에 의해 요구되는 경우</li>
        </ul>
        <p className="mt-3">서비스 제공을 위해 다음 외부 서비스와 데이터를 연동합니다.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left font-medium">서비스명</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-medium">목적</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-medium">전달 데이터</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2">Supabase</td>
                <td className="border border-gray-200 px-3 py-2">회원 인증 및 세션 관리</td>
                <td className="border border-gray-200 px-3 py-2">이메일, 비밀번호(해시), 인증 토큰</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">Google OAuth</td>
                <td className="border border-gray-200 px-3 py-2">소셜 로그인</td>
                <td className="border border-gray-200 px-3 py-2">인증 토큰 (Google에서 이메일·이름 수신)</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">빗썸 API</td>
                <td className="border border-gray-200 px-3 py-2">가상화폐 시세 조회</td>
                <td className="border border-gray-200 px-3 py-2">개인정보 전달 없음 (시세 데이터만 수신)</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">한국투자증권 API</td>
                <td className="border border-gray-200 px-3 py-2">주식 시세 조회</td>
                <td className="border border-gray-200 px-3 py-2">개인정보 전달 없음 (시세 데이터만 수신)</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2">업비트·비트겟 API</td>
                <td className="border border-gray-200 px-3 py-2">Virt 모드 실계좌 연동</td>
                <td className="border border-gray-200 px-3 py-2">사용자가 입력한 API 키 (암호화 전송)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제5조 (개인정보 처리의 위탁)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left font-medium">수탁업체</th>
                <th className="border border-gray-200 px-3 py-2 text-left font-medium">위탁 업무</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2">Supabase Inc.</td>
                <td className="border border-gray-200 px-3 py-2">회원 인증, 이메일 발송, 세션 관리</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제6조 (정보주체의 권리·의무 및 행사방법)</h2>
        <p className="mb-2">이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
        <ol className="list-decimal list-inside space-y-2">
          <li><strong>열람 요구:</strong> 수집된 개인정보의 열람을 요청할 수 있습니다.</li>
          <li><strong>정정·삭제 요구:</strong> 부정확한 개인정보의 정정 또는 삭제를 요청할 수 있습니다.</li>
          <li><strong>처리 정지 요구:</strong> 개인정보 처리의 정지를 요청할 수 있습니다.</li>
          <li><strong>회원 탈퇴:</strong> 서비스 내 설정 또는 이메일 문의를 통해 탈퇴할 수 있습니다.</li>
        </ol>
        <p className="mt-3">
          권리 행사는 서비스 내 설정 페이지 또는 이메일(
          <a href="mailto:khyun1109@gmail.com" className="text-whale-light hover:underline">khyun1109@gmail.com</a>
          )을 통해 가능합니다.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제7조 (개인정보의 파기 절차 및 방법)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>파기 절차: 회원 탈퇴 요청 시 해당 회원의 개인정보를 지체 없이 파기합니다.</li>
          <li>파기 방법: 전자적 파일은 복구 불가능한 방법으로 영구 삭제합니다.</li>
          <li>거래소 API 키: 탈퇴 즉시 암호화된 키 데이터를 삭제합니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제8조 (개인정보 보호책임자)</h2>
        <div className="bg-gray-50 rounded-lg p-4">
          <p><strong>개인정보 보호책임자</strong></p>
          <ul className="mt-2 space-y-1">
            <li>이메일: <a href="mailto:khyun1109@gmail.com" className="text-whale-light hover:underline">khyun1109@gmail.com</a></li>
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의하실 수 있습니다.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-gray-500">
            <li>개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
            <li>개인정보분쟁조정위원회 (kopico.go.kr / 1833-6972)</li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제9조 (개인정보 안전성 확보 조치)</h2>
        <p className="mb-2">서비스는 개인정보의 안전성 확보를 위해 다음의 조치를 취하고 있습니다.</p>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>비밀번호 암호화:</strong> 비밀번호는 해시 처리하여 저장합니다.</li>
          <li><strong>API 키 암호화:</strong> 거래소 API 키는 별도의 암호화 키로 암호화하여 저장합니다.</li>
          <li><strong>전송 구간 암호화:</strong> HTTPS를 통한 데이터 전송 암호화를 적용합니다.</li>
          <li><strong>JWT 인증:</strong> 토큰 기반 인증으로 세션 보안을 유지합니다.</li>
          <li><strong>접근 제한:</strong> 개인정보에 대한 접근 권한을 최소화하고 있습니다.</li>
          <li><strong>요청 제한:</strong> Rate Limiting을 통해 비정상적인 접근을 차단합니다.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제10조 (쿠키 및 로컬 스토리지)</h2>
        <p>
          서비스는 마케팅이나 분석 목적의 쿠키를 사용하지 않습니다. 로그인 세션 유지를 위해
          Supabase 인증 토큰을 브라우저 로컬 스토리지에 저장하며, 이는 서비스 이용에 필수적인
          기능적 목적으로만 사용됩니다.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제11조 (개인정보처리방침의 변경)</h2>
        <p>
          본 개인정보처리방침이 변경되는 경우, 변경 사항을 서비스 내 공지사항을 통해 고지하며,
          변경된 방침은 공지한 날로부터 7일 후에 효력이 발생합니다.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">부칙</h2>
        <p>본 개인정보처리방침은 2026년 4월 8일부터 시행합니다.</p>
      </section>
    </LegalPageLayout>
  );
};

export default PrivacyPage;
