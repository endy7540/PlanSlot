package com.example.planslot.group.entity;

import com.example.planslot.member.entity.Member;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "group_recommendation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
public class GroupRecommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "recommendation_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", nullable = false)
    private Member requestedBy;

    @Column(name = "rank_num")
    private int rank;

    @Column(name = "label", length = 100)
    private String label;

    @Column(name = "sub_text", length = 300)
    private String sub;

    @Column(name = "tag", length = 50)
    private String tag;

    @Column(name = "rec_date", length = 20)
    private String date;

    @Column(name = "rec_time", length = 20)
    private String time;

    @Column(name = "title", length = 100)
    private String title;

    @CreatedDate
    @Column(name = "bookmarked_at", nullable = false, updatable = false)
    private LocalDateTime bookmarkedAt;

    @Builder
    public GroupRecommendation(Group group, Member requestedBy, int rank, String label, String sub, String tag, String date, String time, String title) {
        this.group = group;
        this.requestedBy = requestedBy;
        this.rank = rank;
        this.label = label;
        this.sub = sub;
        this.tag = tag;
        this.date = date;
        this.time = time;
        this.title = title;
    }
}
