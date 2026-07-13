package com.example.planslot.board.service;

import com.example.planslot.board.dto.BoardDTO;
import com.example.planslot.board.dto.BoardImageDTO;
import com.example.planslot.board.entity.BoardType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

public interface BoardService {
    // 게시글 등록
    Long createBoard(BoardType boardType, BoardDTO boardDTO, Long memberId);

    // 게시판 종류별 목록 및 검색
    Page<BoardDTO> getBoardList(BoardType boardType, String keyword, Pageable pageable);

    // 게시글 상세 조회
    BoardDTO getBoardDetail(Long boardId);

    // 게시글 수정
    BoardDTO updateBoard(Long boardId, BoardDTO boardDTO, Long memberId);

    // 게시글 삭제
    void deleteBoard(Long boardId, Long memberId);

    // 게시글 이미지 등록 및 교체
    BoardImageDTO uploadBoardImage(Long boardId, MultipartFile image, Long memberId);

    // 게시글 이미지 DB 정보 삭제
    void deleteBoardImage(Long boardId, Long imageId, Long memberId);
}