package com.example.planslot.global.security.oauth2;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class OAuth2FailureHandler extends SimpleUrlAuthenticationFailureHandler {

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException, ServletException {
        
        HttpSession session = request.getSession(false);
        if (session != null) {
            String linkEmail = (String) session.getAttribute("LINK_GOOGLE_EMAIL");
            if (linkEmail != null) {
                // If it was a Google Calendar Link attempt, redirect back to My Page
                session.removeAttribute("LINK_GOOGLE_EMAIL");
                getRedirectStrategy().sendRedirect(request, response, "/mypage?error=google_link_failed");
                return;
            }
        }
        
        // Default behavior for normal login failures
        super.setDefaultFailureUrl("/auth/login?error");
        super.onAuthenticationFailure(request, response, exception);
    }
}
