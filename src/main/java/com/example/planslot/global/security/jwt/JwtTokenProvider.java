package com.example.planslot.global.security.jwt;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtTokenProvider {
    private final SecretKey key;
    private final long accessTokenValidityTime;

    public JwtTokenProvider(@Value("${jwt.secret}") String secretKey,
                            @Value("${jwt.access-token-validity-in-milliseconds}") long accessTokenValidityTime) {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.accessTokenValidityTime = accessTokenValidityTime;
    }

    public String createAccessToken(String email, String role, boolean keepLogin) {
        long now = (new Date()).getTime();
        long validityTime = keepLogin ? (30L * 24 * 60 * 60 * 1000) : (60L * 60 * 1000);
        Date validity = new Date(now + validityTime);

        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(validity)
                .signWith(key)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String getEmailFromToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }

    public String getRoleFromToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get("role", String.class);
    }

    public boolean shouldRenewToken(String token) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            long issuedAt = claims.getIssuedAt().getTime();
            long expiration = claims.getExpiration().getTime();
            long now = System.currentTimeMillis();

            long totalLifespan = expiration - issuedAt;
            long passedTime = now - issuedAt;

            // 1. 30일(자동 로그인) 토큰인 경우: 발급된 지 1일(24시간)이 지났을 때만 갱신
            if (totalLifespan > (24L * 60 * 60 * 1000)) {
                return passedTime > (24L * 60 * 60 * 1000);
            }

            // 2. 1시간 기본 토큰인 경우: 발급된 지 5분이 지났으면 무조건 갱신
            // (동시성 문제를 방지하기 위해 최소 5분의 쿨타임을 부여)
            return passedTime > (5 * 60 * 1000);
        } catch (Exception e) {
            return false;
        }
    }

    public String renewToken(String token) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            long issuedAt = claims.getIssuedAt().getTime();
            long expiration = claims.getExpiration().getTime();
            long totalLifespan = expiration - issuedAt;
            
            // 기존 토큰의 수명이 24시간을 초과하면 '로그인 유지(keepLogin)'로 간주
            boolean keepLogin = totalLifespan > (24L * 60 * 60 * 1000);
            
            return createAccessToken(claims.getSubject(), claims.get("role", String.class), keepLogin);
        } catch (Exception e) {
            return token;
        }
    }
    
    public boolean isKeepLogin(String token) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            long issuedAt = claims.getIssuedAt().getTime();
            long expiration = claims.getExpiration().getTime();
            return (expiration - issuedAt) > (24L * 60 * 60 * 1000);
        } catch (Exception e) {
            return false;
        }
    }
}
