package com.example.planslot.board.dto;

import com.example.planslot.member.entity.Member;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BoardMemberDTO {
    private Long memberId;
    private String nickname;
    private Member.Role role;
}
