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
@Table(name = "board_application", uniqueConstraints = {
        @UniqueConstraint(name = "uk_board_application_board_applicant", columnNames = {"board_id", "applicant_id"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class BoardApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "application_id")
    private Long applicationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applicant_id", nullable = false)
    private Member applicant;

    @Enumerated(EnumType.STRING)
    @Column(name = "application_status", nullable = false, length = 20)
    private BoardApplicationStatus applicationStatus;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    private BoardApplication(Board board, Member applicant) {
        this.board = board;
        this.applicant = applicant;
        this.applicationStatus = BoardApplicationStatus.PENDING;
    }

    public void accept() {
        this.applicationStatus = BoardApplicationStatus.ACCEPTED;
    }

    public void reject() {
        this.applicationStatus = BoardApplicationStatus.REJECTED;
    }
}
