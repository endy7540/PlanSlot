package com.example.planslot.board.repository;

import com.example.planslot.board.entity.BoardImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BoardImageRepository extends JpaRepository<BoardImage, Long> {
    Optional<BoardImage> findByBoardBoardId(Long boardId);
    Optional<BoardImage> findByFileIdAndBoardBoardId(Long fileId, Long boardId);
}
