package com.project.whalearc.auth.login.constant;

public class Constant {
    // Access Token 만료 시간(1시간)
    public static final int ACCESS_TOKEN_TIME = 3600000;

    // Refresh Token 만료 시간(7일)
    public static final long REFRESH_TOKEN_TIME = 1000L * 60 * 60 * 24 * 7;
}

