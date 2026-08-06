package com.example.planslot.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompCommand;
import com.example.planslot.global.security.jwt.JwtTokenProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import java.util.Collections;
import org.springframework.beans.factory.annotation.Autowired;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

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
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = 
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        String token = authHeader.substring(7);
                        JwtTokenProvider tokenProvider = getJwtTokenProvider(accessor);
                        
                        if (tokenProvider != null && tokenProvider.validateToken(token)) {
                            String email = tokenProvider.getEmailFromToken(token);
                            UsernamePasswordAuthenticationToken authentication = 
                                    new UsernamePasswordAuthenticationToken(email, null, Collections.emptyList());
                            accessor.setUser(authentication);
                        }
                    }
                }
                return message;
            }
        });
    }

    private JwtTokenProvider getJwtTokenProvider(StompHeaderAccessor accessor) {
        // ApplicationContext에서 JwtTokenProvider 빈을 가져옴
        // 웹소켓 환경이므로 SecurityContextHolder 대신 ApplicationContextUtil 등을 활용해야 할 수 있으나
        // WebSocketConfig가 스프링 빈이므로 의존성 주입을 받아두는 게 제일 깔끔함
        return this.jwtTokenProvider;
    }
}
