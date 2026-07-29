package com.example.planslot.global.security.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String token = resolveToken(request);

        if (token != null && jwtTokenProvider.validateToken(token)) {
            String email = jwtTokenProvider.getEmailFromToken(token);

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(email, null, Collections.emptyList());
            SecurityContextHolder.getContext().setAuthentication(authentication);
            
            // 토큰 수명이 절반 이하로 남았으면 자동 갱신 (Sliding Session)
            if (jwtTokenProvider.shouldRenewToken(token)) {
                String newToken = jwtTokenProvider.renewToken(token);
                
                // 쿠키 갱신
                jakarta.servlet.http.Cookie cookie = new jakarta.servlet.http.Cookie("jwtToken", newToken);
                cookie.setPath("/");
                cookie.setHttpOnly(true);
                cookie.setMaxAge(jwtTokenProvider.isKeepLogin(newToken) ? 30 * 24 * 60 * 60 : 60 * 60);
                response.addCookie(cookie);
                
                // 헤더 갱신 (API 클라이언트용)
                response.setHeader("New-Token", newToken);
            }
        }
        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        
        // SSE(Server-Sent Events) 등 파라미터로 오는 경우
        String paramToken = request.getParameter("token");
        if (StringUtils.hasText(paramToken)) {
            return paramToken;
        }
        
        // 쿠키에서 토큰 추출 추가 (웹 페이지 이동 시 권한 유지용)
        if (request.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                if ("jwtToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        
        return null;
    }
}
