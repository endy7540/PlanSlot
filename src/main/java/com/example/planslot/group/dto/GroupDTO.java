package com.example.planslot.group.dto;

import com.example.planslot.group.entity.Group;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public class GroupDTO {

    public record CreateRequest(
            @NotBlank
            @Size(min = 1, max = 30)
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
}
