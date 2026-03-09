package com.project.whalearc.market.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.net.URL;
import java.nio.charset.Charset;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * KRX 전 종목 마스터 관리.
 * - KIS 제공 KOSPI/KOSDAQ 마스터 파일을 다운로드하여 종목 코드 + 이름 매핑
 * - 서버 시작 시 + 매일 06:30 자동 갱신
 */
@Slf4j
@Service
public class StockMasterService {

    private static final String KOSPI_URL = "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip";
    private static final String KOSDAQ_URL = "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip";
    private static final Charset CP949 = Charset.forName("cp949");

    // 코드 → 이름
    private final ConcurrentHashMap<String, String> stockMap = new ConcurrentHashMap<>();
    // 코드 → 마켓 (KOSPI/KOSDAQ)
    private final ConcurrentHashMap<String, String> marketMap = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        loadMasterFiles();
    }

    /** 매일 06:30 갱신 (장 시작 전) */
    @Scheduled(cron = "0 30 6 * * *", zone = "Asia/Seoul")
    public void scheduledRefresh() {
        loadMasterFiles();
    }

    private void loadMasterFiles() {
        try {
            Map<String, String> kospi = downloadAndParse(KOSPI_URL, 228);
            Map<String, String> kosdaq = downloadAndParse(KOSDAQ_URL, 222);

            // 새 맵을 먼저 완성 후 한 번에 교체 (레이스 컨디션 방지)
            ConcurrentHashMap<String, String> newStockMap = new ConcurrentHashMap<>();
            ConcurrentHashMap<String, String> newMarketMap = new ConcurrentHashMap<>();
            newStockMap.putAll(kospi);
            newStockMap.putAll(kosdaq);
            for (String code : kospi.keySet()) newMarketMap.put(code, "KOSPI");
            for (String code : kosdaq.keySet()) newMarketMap.put(code, "KOSDAQ");

            stockMap.clear();
            stockMap.putAll(newStockMap);
            marketMap.clear();
            marketMap.putAll(newMarketMap);

            log.info("종목 마스터 로드 완료: KOSPI {}개, KOSDAQ {}개, 합계 {}개",
                    kospi.size(), kosdaq.size(), stockMap.size());
        } catch (Exception e) {
            log.error("종목 마스터 로드 실패: {}", e.getMessage());
        }
    }

    /**
     * 종목 검색 (이름 또는 코드 부분 매칭)
     * @return 매칭 종목 리스트 [{code, name, market}], 최대 20개
     */
    public List<Map<String, String>> search(String keyword) {
        if (keyword == null || keyword.isBlank()) return List.of();

        String kw = keyword.trim().toUpperCase();
        List<Map<String, String>> results = new ArrayList<>();

        for (Map.Entry<String, String> entry : stockMap.entrySet()) {
            String code = entry.getKey();
            String name = entry.getValue();

            if (code.contains(kw) || name.toUpperCase().contains(kw)) {
                results.add(Map.of(
                        "code", code,
                        "name", name,
                        "market", marketMap.getOrDefault(code, "KRX")
                ));
                if (results.size() >= 20) break;
            }
        }

        return results;
    }

    /** 종목 코드로 이름 조회 */
    public String getStockName(String code) {
        return stockMap.get(code);
    }

    /** 종목 존재 여부 */
    public boolean exists(String code) {
        return stockMap.containsKey(code);
    }

    public int getTotalCount() {
        return stockMap.size();
    }

    /**
     * KIS 종목 마스터 zip 다운로드 + 파싱
     * 파일 형식: [단축코드(9)][표준코드(12)][한글명(가변)]...[고정필드(tailSize bytes)]
     */
    private Map<String, String> downloadAndParse(String url, int tailSize) throws Exception {
        Map<String, String> result = new LinkedHashMap<>();

        try (ZipInputStream zis = new ZipInputStream(new URL(url).openStream())) {
            ZipEntry entry = zis.getNextEntry();
            if (entry == null) return result;

            byte[] allBytes = zis.readAllBytes();
            String content = new String(allBytes, CP949);

            for (String line : content.split("\n")) {
                if (line.length() < 21 + tailSize) continue;

                try {
                    // 고정 tail 분리
                    byte[] lineBytes = line.getBytes(CP949);
                    if (lineBytes.length < 21 + tailSize) continue;

                    int nameEnd = lineBytes.length - tailSize;
                    String shortCode = new String(lineBytes, 0, 9, CP949).trim();
                    // 표준코드: 9~21 (12자리) — 건너뜀
                    String korName = new String(lineBytes, 21, nameEnd - 21, CP949).trim();

                    // 6자리 종목코드만 (ETN/ETF 등 9자리 제외)
                    if (shortCode.length() >= 6) {
                        String code6 = shortCode.substring(0, 6);
                        // 숫자로만 된 종목코드만 (A 접두사 등 제외)
                        if (code6.matches("\\d{6}") && !korName.isEmpty()) {
                            result.put(code6, korName);
                        }
                    }
                } catch (Exception e) {
                    // 파싱 실패한 줄은 건너뜀
                }
            }
        }

        return result;
    }
}
