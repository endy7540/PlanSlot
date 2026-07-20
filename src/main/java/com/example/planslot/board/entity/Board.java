package com.example.planslot.board.entity;

import com.example.planslot.member.entity.Member;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "board")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class Board {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "board_id")
    private Long boardId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "writer_id", nullable = false)
    private Member writer;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "view_count", nullable = false)
    private int viewCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "board_type", nullable = false, length = 30)
    private BoardType boardType;

    @Enumerated(EnumType.STRING)
    @Column(name = "board_status", nullable = false, length = 30)
    private BoardStatus boardStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "recruitment_status", length = 20)
    private BoardRecruitmentStatus recruitmentStatus;

    @Column(name = "group_id", unique = true)
    private Long groupId;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    private Board(Member writer, String title, String content, BoardType boardType) {
        this.writer = writer;
        this.title = title;
        this.content = content;
        this.viewCount = 0;
        this.boardType = boardType;
        this.boardStatus = BoardStatus.ACTIVE;
        this.recruitmentStatus = boardType == BoardType.STUDY || boardType == BoardType.GROUP
                ? BoardRecruitmentStatus.OPEN
                : null;
    }

    public void update(String title, String content) {
        this.title = title;
        this.content = content;
    }

    public void delete() {
        this.boardStatus = BoardStatus.DELETED;
    }

    public boolean isRecruitmentBoard() {
        return boardType == BoardType.STUDY || boardType == BoardType.GROUP;
    }

    public boolean isRecruitmentOpen() {
        return isRecruitmentBoard() && recruitmentStatus != BoardRecruitmentStatus.CLOSED && groupId == null;
    }

    public BoardRecruitmentStatus getEffectiveRecruitmentStatus() {
        if (!isRecruitmentBoard()) {
            return null;
        }

        return recruitmentStatus == null ? BoardRecruitmentStatus.OPEN : recruitmentStatus;
    }

}
