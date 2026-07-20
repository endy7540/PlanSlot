package com.example.planslot.board.dto;

import com.example.planslot.board.entity.BoardApplicationStatus;
import com.example.planslot.board.entity.BoardRecruitmentStatus;
import com.example.planslot.board.entity.BoardStatus;
import com.example.planslot.board.entity.BoardType;
import com.example.planslot.group.entity.GroupMemberStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardDTO {
    private Long boardId;
    private Long writerId;
    private String writerNickname;
    private String writerProfileImageUrl;
    private String title;
    private String content;
    private Integer viewCount;
    private BoardType boardType;
    private BoardStatus boardStatus;
    private BoardRecruitmentStatus recruitmentStatus;
    private Long groupId;
    private Boolean groupCreated;
    private BoardApplicationStatus myApplicationStatus;
    private GroupMemberStatus myGroupMemberStatus;
    private BoardImageDTO boardImage;
    private Long commentCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
