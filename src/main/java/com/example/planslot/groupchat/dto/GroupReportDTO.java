package com.example.planslot.groupchat.dto;

import lombok.Getter;
import lombok.Setter;

public class GroupReportDTO {
    
    @Getter
    @Setter
    public static class Request {
        private Long messageId;
        private String reason;
        private String reasonDetail;
    }
}
