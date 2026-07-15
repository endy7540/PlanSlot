package com.example.planslot.global.security.config;

import com.example.planslot.global.security.jwt.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpMethod;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    private final com.example.planslot.global.security.oauth2.CustomOAuth2UserService customOAuth2UserService;
    private final com.example.planslot.global.security.oauth2.OAuth2SuccessHandler oAuth2SuccessHandler;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/auth/signup", "/auth/login", "/error", "/auth", "/home", "/favicon.ico",
                                "/members/checkDuplicate", "/api/test/**","/auth/email/send", "/auth/email/verify", "/auth/oauth2-callback",
                                "/css/**", "/js/**", "/images/**", "/group/**", "/notification/list", "/board", "/board/notice",
                                "/board/study", "/board/club", "/board/free", "/board/detail/**", "/board/write/**").permitAll()
                        .requestMatchers("/", "/api/members/signup", "/api/auth/login", "/error", "/auth", "/home", "/favicon.ico",
                                "/api/test/**", "/css/**", "/js/**", "/images/**", "/group/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/schedule", "/schedule/*").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2Login(oauth2 -> oauth2
                        .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                        .successHandler(oAuth2SuccessHandler)
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
