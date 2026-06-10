package com.project.whalearc.live.config;

import com.project.whalearc.live.domain.LiveOrderLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

/**
 * 라이브 자동매매 멱등성 unique 인덱스 보장(부팅 시 1회).
 *
 * <p>{@code LiveOrderLog.clientOrderId} 에 {@code @Indexed(unique=true)} 가 선언돼 있으나, 전역
 * {@code spring.data.mongodb.auto-index-creation} 은 의도적으로 꺼 둔다 — 기존 컬렉션(PortfolioSnapshot·
 * Portfolio·User·VirtCredential·TurtlePosition 등)에 이미 중복 데이터가 있으면 전역 활성화 시 unique 인덱스
 * 생성 실패로 <b>부팅이 깨지기</b> 때문이다.
 *
 * <p>대신 신규 컬렉션인 {@code live_order_log} 에 한해서만 부팅 시 unique 인덱스를 보장한다. 같은 봉의
 * 중복 발주를 DB 레벨에서도 차단해(단일 인스턴스는 {@code UserLockRegistry} 로도 직렬화되지만) 수평 확장 시의
 * 이중 체결 방어선을 만든다. 인덱스 생성이 실패해도(예: 예기치 못한 기존 중복) 경고만 남기고 부팅을 막지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LiveIndexInitializer implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            mongoTemplate.indexOps(LiveOrderLog.class)
                    .ensureIndex(new Index().on("clientOrderId", Sort.Direction.ASC).unique());
            log.info("라이브 멱등성 인덱스 보장 완료: live_order_log.clientOrderId (unique)");
        } catch (Exception e) {
            log.warn("라이브 멱등성 인덱스 생성 실패(부팅 계속): {}", e.getMessage());
        }
    }
}
