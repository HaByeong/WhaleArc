package com.project.whalearc.live.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 자동매매 접근 가드 인터셉터를 /api/live/** 전체에 등록한다.
 */
@Configuration
@RequiredArgsConstructor
public class AutoTradeWebMvcConfig implements WebMvcConfigurer {

    private final AutoTradeAccessInterceptor autoTradeAccessInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(autoTradeAccessInterceptor).addPathPatterns("/api/live/**");
    }
}
