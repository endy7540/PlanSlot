package com.example.planslot.global.security.config;

import jakarta.servlet.http.HttpServletResponse;

import com.example.planslot.global.security.jwt.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.RegexRequestMatcher;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final com.example.planslot.global.security.oauth2.CustomOAuth2UserService customOAuth2UserService;
    private final com.example.planslot.global.security.oauth2.OAuth2SuccessHandler oAuth2SuccessHandler;
    private final com.example.planslot.global.security.oauth2.OAuth2FailureHandler oAuth2FailureHandler;
    private final org.springframework.security.oauth2.client.registration.ClientRegistrationRepository clientRegistrationRepository;

    private org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver authorizationRequestResolver(
            org.springframework.security.oauth2.client.registration.ClientRegistrationRepository clientRegistrationRepository) {
        org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver resolver =
                new org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver(
                        clientRegistrationRepository, "/oauth2/authorization");
        resolver.setAuthorizationRequestCustomizer(customizer -> {
            customizer.additionalParameters(params -> {
                params.put("access_type", "offline");
                params.put("prompt", "consent");
            });
        });
        return resolver;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                // 공통 및 정적 리소스
                                "/", "/planslot", "/error", "/favicon.ico",
                                "/css/**", "/js/**", "/images/**", "/uploads/**",

                                // 인증 및 회원가입 관련
                                "/auth", "/auth/signup", "/auth/login", "/auth/email/send",
                                "/auth/email/verify", "/auth/find-id", "/auth/find-pw", "/auth/oauth2-callback", "/auth/terms",
                                "/members/checkDuplicate",

                                // 도메인 화면 및 기타
                                "/group/**", "/groupChat/**", "/notification/list",
                                "/board", "/board/notice", "/board/study", "/board/group", "/board/free",
                                "/board/read/**", "/board/register/**",
                                
                                // WebSocket Endpoint
                                "/ws-stomp/**"
                        ).permitAll()
                        // 비로그인 게시판 목록 조회
                        .requestMatchers(HttpMethod.GET, "/board/type/**").permitAll()
                        // 비로그인 게시글 및 댓글 조회
                        .requestMatchers(
                                new RegexRequestMatcher("^/board/\\d+$", "GET"),
                                new RegexRequestMatcher("^/board/\\d+/comments(?:\\?.*)?$", "GET")
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, "/schedule", "/schedule/*").permitAll()
                        .requestMatchers("/api/chatbot/**").authenticated()
                        .anyRequest().authenticated()
                )
                .oauth2Login(oauth2 -> oauth2
                        .loginPage("/auth/login")
                        .authorizationEndpoint(auth -> auth
                                .authorizationRequestResolver(authorizationRequestResolver(clientRegistrationRepository))
                        )
                        .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                        .successHandler(oAuth2SuccessHandler)
                        .failureHandler(oAuth2FailureHandler)
                )
                .exceptionHandling(exception -> exception
                        .defaultAuthenticationEntryPointFor((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setCharacterEncoding("UTF-8");
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"success\":false,\"errorCode\":\"CHATBOT_UNAUTHORIZED\",\"message\":\"로그인이 만료되었어요. 다시 로그인해 주세요.\"}");
                        }, request -> request.getRequestURI().startsWith("/api/chatbot"))
                        .authenticationEntryPoint((request, response, authException) -> response.sendRedirect("/auth/login"))
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}

