import LegalPageLayout from '../components/LegalPageLayout';

const TermsPage = () => {
  return (
    <LegalPageLayout title="이용약관" updatedDate="2026년 4월 8일">
      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제1조 (목적)</h2>
        <p>
          본 약관은 WhaleArc(이하 "서비스")가 제공하는 모의투자 및 관련 서비스의 이용 조건과 절차,
          이용자와 서비스 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제2조 (정의)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>"서비스"란 WhaleArc가 제공하는 웹 기반 모의투자 플랫폼 및 관련 부가 서비스를 의미합니다.</li>
          <li>"회원"이란 본 약관에 동의하고 서비스에 가입하여 이용하는 자를 의미합니다.</li>
          <li>"가상자금"이란 서비스 내에서 모의투자 목적으로 제공되는 실제 화폐가 아닌 가상의 투자 자금을 의미합니다.</li>
          <li>"포트폴리오"란 회원이 가상자금을 활용하여 구성한 투자 자산 목록을 의미합니다.</li>
          <li>"전략"이란 서비스에서 제공하는 퀀트 투자 알고리즘 및 백테스트 기능을 의미합니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제3조 (약관의 효력 및 변경)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>본 약관은 서비스 화면에 게시하거나 기타 방법으로 회원에게 공지함으로써 효력이 발생합니다.</li>
          <li>서비스는 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 약관을 변경할 수 있으며, 변경 시 적용 일자 및 변경 사유를 명시하여 서비스 내에 공지합니다.</li>
          <li>회원은 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제4조 (서비스의 제공)</h2>
        <p>서비스는 다음과 같은 기능을 제공합니다.</p>
        <ol className="list-decimal list-inside space-y-2 mt-2">
          <li>가상자금을 활용한 주식 및 가상화폐 모의투자</li>
          <li>실시간 시세 조회 (주식, 가상화폐)</li>
          <li>포트폴리오 구성 및 수익률 분석</li>
          <li>퀀트 전략 백테스트 및 학습</li>
          <li>투자 랭킹 시스템</li>
          <li>거래소 API 연동을 통한 실계좌 자산 조회 (Virt 모드)</li>
          <li>기타 서비스가 정하는 부가 기능</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제5조 (회원가입 및 계정)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>회원가입은 이메일 또는 Google OAuth를 통해 가능하며, 본 약관 및 개인정보처리방침에 동의한 후 가입이 완료됩니다.</li>
          <li>회원은 정확하고 최신의 정보를 제공해야 하며, 허위 정보 제공 시 서비스 이용이 제한될 수 있습니다.</li>
          <li>회원은 자신의 계정 정보를 관리할 책임이 있으며, 타인에게 계정을 양도하거나 공유할 수 없습니다.</li>
          <li>닉네임은 부적절한 표현(비속어, 혐오 표현 등)을 포함할 수 없으며, 서비스는 이를 제한할 권리가 있습니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제6조 (서비스 이용)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>서비스는 원칙적으로 연중무휴 24시간 제공됩니다. 단, 시스템 점검, 장애 발생 등의 사유로 일시적으로 중단될 수 있습니다.</li>
          <li>회원은 서비스를 이용함에 있어 관련 법령, 본 약관 및 서비스의 공지사항을 준수해야 합니다.</li>
          <li>다음 행위는 금지됩니다:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
              <li>서비스의 정상적인 운영을 방해하는 행위</li>
              <li>타인의 정보를 도용하거나 부정하게 사용하는 행위</li>
              <li>서비스를 통해 얻은 정보를 무단으로 상업적 목적에 이용하는 행위</li>
              <li>비정상적인 방법으로 서비스를 이용하는 행위 (자동화 도구, 크롤링 등)</li>
            </ul>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제7조 (모의투자 관련 특약)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>서비스에서 제공하는 모의투자는 <strong>교육 및 학습 목적</strong>으로만 제공되며, 실제 금전 거래가 발생하지 않습니다.</li>
          <li>가상자금은 현금으로 교환하거나 출금할 수 없으며, 어떠한 재산적 가치도 가지지 않습니다.</li>
          <li>모의투자 결과는 실제 시장 환경과 다를 수 있으며(슬리피지, 수수료, 시장 충격 등), 서비스는 모의투자 결과의 정확성을 보장하지 않습니다.</li>
          <li>서비스에서 제공하는 정보, 전략, 분석 결과는 <strong>투자 권유가 아니며</strong>, 이를 근거로 한 실제 투자에 대한 책임은 회원 본인에게 있습니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제8조 (지식재산권)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>서비스에 포함된 콘텐츠(디자인, 로고, 텍스트, 소프트웨어 등)에 대한 지식재산권은 서비스에 귀속됩니다.</li>
          <li>회원은 서비스의 콘텐츠를 개인적·비상업적 용도로만 이용할 수 있으며, 무단 복제·배포·수정을 금합니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제9조 (면책조항)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>서비스는 모의투자 플랫폼이며, 투자 자문 서비스가 아닙니다. 서비스에서 제공하는 어떠한 정보도 투자 조언으로 해석되어서는 안 됩니다.</li>
          <li>서비스는 시세 데이터의 실시간성 및 정확성을 보장하지 않습니다. 시세 데이터는 제3자 API(빗썸, 한국투자증권 등)를 통해 제공되며, 지연 또는 오류가 발생할 수 있습니다.</li>
          <li>서비스는 천재지변, 시스템 장애, 제3자 서비스 중단 등 불가항력적 사유로 인한 서비스 중단에 대해 책임지지 않습니다.</li>
          <li>회원이 서비스를 통해 얻은 정보를 바탕으로 실행한 실제 투자로 인한 손실에 대해 서비스는 어떠한 법적 책임도 지지 않습니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제10조 (서비스 중단 및 변경)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>서비스는 사전 공지 후 서비스 내용을 변경하거나 중단할 수 있습니다.</li>
          <li>긴급한 시스템 점검 또는 장애 발생 시 사전 공지 없이 서비스를 일시 중단할 수 있습니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제11조 (이용계약의 해지)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>회원은 언제든지 서비스 내 설정 또는 문의를 통해 회원 탈퇴를 요청할 수 있습니다.</li>
          <li>서비스는 회원이 본 약관을 위반한 경우, 사전 통지 후 이용을 제한하거나 계약을 해지할 수 있습니다.</li>
          <li>탈퇴 시 회원의 개인정보는 개인정보처리방침에 따라 처리됩니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">제12조 (분쟁해결)</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>본 약관에 관한 분쟁은 대한민국 법률을 적용합니다.</li>
          <li>서비스 이용과 관련하여 발생한 분쟁에 대해서는 민사소송법상의 관할 법원에 소를 제기할 수 있습니다.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">부칙</h2>
        <p>본 약관은 2026년 4월 8일부터 시행합니다.</p>
      </section>
    </LegalPageLayout>
  );
};

export default TermsPage;
