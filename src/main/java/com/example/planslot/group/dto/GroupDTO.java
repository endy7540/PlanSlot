package com.example.planslot.group.dto;

import com.example.planslot.group.entity.Group;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;
import com.example.planslot.group.entity.GroupMember;

public class GroupDTO {

    public record CreateRequest(
            @NotBlank(message = "모임 이름을 입력해주세요.")
            @Size(min = 1, max = 30, message = "모임 이름은 30자 이하로 입력해주세요.")
            String groupName
    ) {
    }

    public record Response(
            Long groupId,
            String groupName,
            Long ownerId,
            String ownerNickname,
            int personCount,
            LocalDateTime createdAt
    ) {
        public static Response from(Group group) {
            return new Response(
                    group.getId(),
                    group.getGroupName(),
                    group.getOwner().getId(),
                    group.getOwner().getDisplayName(),
                    group.getPersonCount(),
                    group.getCreatedAt()
            );
        }
    }

    public record ListResponse(
            String id,
            String name,
            String ownerId,
            String filter,
            int memberCount,
            String profileImageUrl,
            int unreadChatCount,
            boolean isFavorite
    ) {
        public static ListResponse of(GroupMember groupMember, int activeCount) {
            String filter = groupMember.getMemberStatus().name().equals("WAITING") ? "waiting" : "joined";
            return new ListResponse(
                    groupMember.getGroup().getId().toString(),
                    groupMember.getGroup().getGroupName(),
                    groupMember.getGroup().getOwner().getId().toString(),
                    filter,
                    activeCount,
                    groupMember.getGroup().getProfileImageUrl(),
                    groupMember.getUnreadChatCount(),
                    groupMember.isFavorite()
            );
        }
    }

    public record MemberInfo(String id, String name, String role, String profileImageUrl, String color) {}
    public record WaitingInfo(String id, String email, String inviterName, boolean isMe) {}
    public record ScheduleInfo(String id, String title, String date, String time, String visibility) {}
    public record HeatInfo(String name, List<String> row) {}
    public record CalendarScheduleInfo(String id, String nickname, String title, String startDate, String endDate, String time, String isPublic) {}
    public record SharedPeerSchedule(String shareId, String scheduleId, String title, String date, String time, String sharerName, String isPublic, String scheduleType) {}

    public record DetailResponse(
            String id,
            String name,
            String ownerId,
            String filter,
            String myMemberId,
            String profileImageUrl,
            List<MemberInfo> members,
            List<WaitingInfo> waiting,
            List<ScheduleInfo> mySchedules,
            List<HeatInfo> heat,
            List<RecInfo> recs
    ) {}

    public record RecInfo(
            @JsonProperty("rank") int rank,
            @JsonProperty("label") String label,
            @JsonProperty("sub") String sub,
            @JsonProperty("tag") String tag,
            @JsonProperty("date") String date,
            @JsonProperty("time") String time,
            @JsonProperty("title") String title
    ) {}
    public record ImportResult(boolean success, String overlappingTitle, String overlappingTime, String importedDate) {}
    public record AiResponse(List<HeatInfo> heat, List<RecInfo> recs) {}

}
