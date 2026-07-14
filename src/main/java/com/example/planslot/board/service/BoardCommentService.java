package com.example.planslot.board.service;

import com.example.planslot.board.dto.BoardCommentDTO;

import java.util.List;

public interface BoardCommentService {
    // 댓글 및 대댓글 등록
    Long createComment(Long boardId, BoardCommentDTO commentDTO, Long memberId);
    // 게시글 댓글 목록 조회
    List<BoardCommentDTO> getCommentList(Long boardId);
    // 댓글 및 대댓글 수정
    BoardCommentDTO updateComment(Long commentId, BoardCommentDTO commentDTO, Long memberId);
    // 댓글 및 대댓글 삭제
    void deleteComment(Long commentId, Long memberId);
}
