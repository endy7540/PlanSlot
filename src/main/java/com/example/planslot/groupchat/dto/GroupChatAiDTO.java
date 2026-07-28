package com.example.planslot.groupchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.util.List;

public class GroupChatAiDTO {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Response {
        private String summary;
        private List<ProposedSchedule> proposedSchedules;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProposedSchedule {
        private String title;
        private String date; // YYYY-MM-DD
        private String endDate; // YYYY-MM-DD
        private String time; // HH:mm
        private String endTime; // HH:mm
    }
}
