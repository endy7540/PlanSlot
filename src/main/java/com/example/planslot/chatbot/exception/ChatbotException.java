package com.example.planslot.chatbot.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class ChatbotException extends RuntimeException {
    private final HttpStatus status;
    private final String errorCode;
    private final String userMessage;

    public ChatbotException(HttpStatus status, String errorCode, String userMessage) {
        super(errorCode);
        this.status = status;
        this.errorCode = errorCode;
        this.userMessage = userMessage;
    }
}
