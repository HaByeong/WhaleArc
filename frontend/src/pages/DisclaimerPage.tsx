import LegalPageLayout from '../components/LegalPageLayout';

const DisclaimerPage = () => {
  return (
    <LegalPageLayout title="투자 면책 고지" updatedDate="2026년 4월 8일">
      <section>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="font-semibold text-amber-800">
            WhaleArc는 모의투자 플랫폼이며, 실제 금전 거래가 발생하지 않습니다.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">1. 서비스 성격</h2>
        <p>
          WhaleArc(이하 "서비스")는 교육 및 학습 목적의 모의투자 플랫폼입니다.
          서비스에서 사용되는 모든 자금은 가상자금이며, 실제 화폐 가치를 가지지 않습니다.
          서비스 내에서의 매매는 실제 금융 거래가 아닙니다.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">2. 투자 권유 아님</h2>
        <p>
          서비스에서 제공하는 모든 정보(시세 데이터, 차트 분석, 퀀트 전략, 백테스트 결과, 랭킹 등)는
          <strong> 투자 권유가 아니며</strong>, 교육 및 참고 목적으로만 제공됩니다.
          서비스의 어떠한 콘텐츠도 특정 자산의 매수·매도를 권장하는 것으로 해석되어서는 안 됩니다.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">3. 과거 수익률과 미래 수익</h2>
        <p>
          과거의 투자 수익률, 백테스트 결과, 전략 성과 등은 미래의 수익을 보장하지 않습니다.
          모의투자에서 달성한 수익률이 실제 투자에서도 동일하게 달성될 것이라는 보장은 없습니다.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">4. 시세 데이터의 한계</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>시세 데이터는 빗썸, 한국투자증권 등 제3자 API를 통해 제공되며, 실시간 데이터와 차이가 있을 수 있습니다 (약 10~20초 지연).</li>
          <li>데이터 제공 업체의 시스템 장애, 네트워크 문제 등으로 시세 정보가 일시적으로 부정확하거나 제공되지 않을 수 있습니다.</li>
          <li>서비스는 시세 데이터의 정확성, 완전성, 적시성을 보장하지 않습니다.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">5. 모의투자와 실제 시장의 차이</h2>
        <p className="mb-2">모의투자 환경과 실제 시장 환경에는 다음과 같은 차이가 있습니다.</p>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>슬리피지:</strong> 실제 시장에서는 주문 체결 시 예상 가격과 실제 체결 가격 간 차이가 발생할 수 있습니다.</li>
          <li><strong>수수료:</strong> 실제 거래에서는 매매 수수료, 세금 등이 부과됩니다.</li>
          <li><strong>시장 충격:</strong> 대량 주문 시 시장 가격에 영향을 미칠 수 있으나, 모의투자에서는 이를 반영하지 않습니다.</li>
          <li><strong>유동성:</strong> 실제 시장에서는 유동성 부족으로 원하는 가격에 체결되지 않을 수 있습니다.</li>
          <li><strong>심리적 요소:</strong> 실제 자금이 관련된 투자에서는 심리적 압박이 의사결정에 영향을 미칩니다.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">6. Virt 모드 (실계좌 연동)</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Virt 모드에서 연동되는 거래소 API 키는 암호화하여 저장되나, 서비스는 거래소 계정의 보안에 대한 최종 책임을 지지 않습니다.</li>
          <li>거래소 API 키는 읽기 전용 권한만 부여할 것을 강력히 권장합니다.</li>
          <li>Virt 모드는 자산 현황 조회 목적이며, 서비스가 이용자의 거래소 계정을 통해 실제 매매를 실행하지 않습니다.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-whale-dark mb-3">7. 투자 손실에 대한 책임</h2>
        <p>
          투자에 대한 최종 판단과 책임은 투자자 본인에게 있습니다.
          서비스에서 제공하는 정보를 참고하여 실제 투자를 진행한 경우, 그로 인해 발생하는
          이익 또는 손실에 대해 <strong>WhaleArc는 어떠한 법적 책임도 지지 않습니다</strong>.
        </p>
        <p className="mt-3">
          실제 투자를 진행하기 전에 반드시 공인된 투자 전문가의 조언을 구하시기 바랍니다.
        </p>
      </section>

      <section>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            본 면책 고지는 서비스 이용약관의 일부를 구성하며, 이용약관과 함께 적용됩니다.
            서비스를 이용하는 것은 본 면책 고지의 내용에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </section>
    </LegalPageLayout>
  );
};

export default DisclaimerPage;
