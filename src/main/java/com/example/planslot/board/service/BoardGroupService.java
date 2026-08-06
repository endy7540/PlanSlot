package com.example.planslot.board.service;

import com.example.planslot.board.dto.BoardGroupDTO;

public interface BoardGroupService {

    // 게시글 참가 신청
    Long apply(Long boardId, String memberEmail);

    // 게시글 참가 신청 취소
    void cancelApplication(Long boardId, String memberEmail);

    // 모임 생성 후보 조회
    BoardGroupDTO.CandidatesResponse getCandidates(Long boardId, String memberEmail);

    // 게시글 기반 모임 생성
    Long createGroup(Long boardId, BoardGroupDTO.CreateRequest request, String memberEmail);
}
