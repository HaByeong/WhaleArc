package com.project.whalearc.exchange.service;

import com.project.whalearc.exchange.domain.ExchangeAccount;
import com.project.whalearc.exchange.domain.ExchangePortfolioSnapshot;
import com.project.whalearc.exchange.dto.ExchangePortfolioDto;
import com.project.whalearc.exchange.repository.ExchangeAccountRepository;
import com.project.whalearc.exchange.repository.ExchangePortfolioSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 실계좌(거래소) 자산 일별 스냅샷 스케줄러.
 * 매일 00:30(KST) 연결된 모든 거래소의 평가금액(KRW)을 합산해 유저별 1건 저장.
 * 거래소 조회는 기존 {@link ExchangeAccountService#getPortfolio} 경로를 그대로 재사용(브로커 API).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExchangeSnapshotScheduler {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final ExchangeAccountRepository accountRepository;
    private final ExchangePortfolioSnapshotRepository snapshotRepository;
    private final ExchangeAccountService exchangeAccountService;

    /**
     * 매일 00:30(KST) — 페이퍼 스냅샷(자정)과 시각을 살짝 분리해 부하 분산.
     * 일부 거래소 조회 실패 시 그 유저는 스킵(부분 합계로 인한 허위 급락 방지 — 공백이 거짓 하락보다 낫다).
     */
    @Scheduled(cron = "0 30 0 * * *", zone = "Asia/Seoul")
    public void captureDaily() {
        LocalDate today = LocalDate.now(KST);

        // 연결된 계정만 모아 유저별 거래소 목록으로 그룹화
        Map<String, List<String>> userExchanges = accountRepository.findAll().stream()
                .filter(ExchangeAccount::isConnected)
                .collect(Collectors.groupingBy(
                        ExchangeAccount::getUserId,
                        Collectors.mapping(ExchangeAccount::getExchangeType, Collectors.toList())));

        int saved = 0;
        for (Map.Entry<String, List<String>> entry : userExchanges.entrySet()) {
            String userId = entry.getKey();
            try {
                if (snapshotRepository.findByUserIdAndDate(userId, today).isPresent()) {
                    continue; // 이미 오늘치 있으면 중복 방지
                }
                double total = 0;
                boolean allOk = true;
                for (String exchangeType : entry.getValue()) {
                    ExchangePortfolioDto dto = exchangeAccountService.getPortfolio(userId, exchangeType);
                    if (!dto.isFetchOk()) { allOk = false; break; }   // 키 만료/조회 실패 → 이 유저 스킵
                    total += dto.getTotalValue();                      // totalValue는 이미 KRW 정규화
                }
                if (!allOk) {
                    log.debug("실계좌 스냅샷 스킵(거래소 조회 실패) [{}]", userId);
                    continue;
                }
                snapshotRepository.save(new ExchangePortfolioSnapshot(userId, today, total));
                saved++;
            } catch (Exception e) {
                log.debug("실계좌 스냅샷 저장 스킵 [{}]: {}", userId, e.getMessage());
            }
        }

        log.info("실계좌 자산 스냅샷 완료: {}건 / 연결 유저 {}명", saved, userExchanges.size());
    }
}
