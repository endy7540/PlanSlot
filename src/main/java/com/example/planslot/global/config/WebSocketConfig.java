package com.example.planslot.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // 클라이언트가 구독(Subscribe)할 prefix (이 경로로 서버가 메시지를 보내면 클라이언트가 받음)
        config.enableSimpleBroker("/sub");
        
        // 클라이언트가 서버로 메시지를 보낼 때(Publish) 붙일 prefix
        config.setApplicationDestinationPrefixes("/pub");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 클라이언트가 최초로 웹소켓 연결(handshake)을 맺는 엔드포인트
        registry.addEndpoint("/ws-stomp")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        registration.interceptors(new org.springframework.messaging.support.ChannelInterceptor() {
            @Override
            public org.springframework.messaging.Message<?> preSend(org.springframework.messaging.Message<?> message, org.springframework.messaging.MessageChannel channel) {
                org.springframework.messaging.simp.stomp.StompHeaderAccessor accessor = 
                        org.springframework.messaging.support.MessageHeaderAccessor.getAccessor(message, org.springframework.messaging.simp.stomp.StompHeaderAccessor.class);
                
                if (accessor != null && org.springframework.messaging.simp.stomp.StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        String token = authHeader.substring(7);
                        com.example.planslot.global.security.jwt.JwtTokenProvider jwtTokenProvider = 
                                getJwtTokenProvider(accessor);
                        
                        if (jwtTokenProvider != null && jwtTokenProvider.validateToken(token)) {
                            String email = jwtTokenProvider.getEmailFromToken(token);
                            org.springframework.security.authentication.UsernamePasswordAuthenticationToken authentication = 
                                    new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(email, null, java.util.Collections.emptyList());
                            accessor.setUser(authentication);
                        }
                    }
                }
                return message;
            }
        });
    }

    private com.example.planslot.global.security.jwt.JwtTokenProvider getJwtTokenProvider(org.springframework.messaging.simp.stomp.StompHeaderAccessor accessor) {
        // ApplicationContext에서 JwtTokenProvider 빈을 가져옴
        // 웹소켓 환경이므로 SecurityContextHolder 대신 ApplicationContextUtil 등을 활용해야 할 수 있으나
        // WebSocketConfig가 스프링 빈이므로 의존성 주입을 받아두는 게 제일 깔끔함
        return this.jwtTokenProvider;
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.example.planslot.global.security.jwt.JwtTokenProvider jwtTokenProvider;
}
