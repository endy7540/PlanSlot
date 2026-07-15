package com.example.planslot.group.dto;

import com.example.planslot.group.entity.Group;

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
                    group.getOwner().getNickname(),
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
            int memberCount
    ) {
        public static ListResponse of(GroupMember groupMember, int activeCount) {
            String filter = groupMember.getMemberStatus().name().equals("WAITING") ? "waiting" : "joined";
            return new ListResponse(
                    groupMember.getGroup().getId().toString(),
                    groupMember.getGroup().getGroupName(),
                    groupMember.getGroup().getOwner().getId().toString(),
                    filter,
                    activeCount
            );
        }
    }

    public record MemberInfo(String id, String name, String role) {}
    public record WaitingInfo(String id, String email, String inviterName, boolean isMe) {}
    public record ScheduleInfo(String id, String title, String date, String time, String visibility) {}
    public record HeatInfo(String name, List<String> row) {}
    public record CalendarScheduleInfo(String id, String nickname, String title, String startDate, String time, String isPublic) {}

    public record DetailResponse(
            String id,
            String name,
            String ownerId,
            String filter,
            String myMemberId,
            List<MemberInfo> members,
            List<WaitingInfo> waiting,
            List<ScheduleInfo> mySchedules,
            List<HeatInfo> heat,
            List<Object> recs
    ) {}
}
