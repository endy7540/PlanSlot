package com.example.planslot.member.repository;

import com.example.planslot.member.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {
    Optional<Member> findByLoginId(String loginId);
    Optional<Member> findByEmail(String email);

    boolean existsByLoginId(String loginId);
    boolean existsByEmail(String email);
    boolean existsByNickname(String nickname);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE Member m SET m.status = 'ACTIVE', m.suspendedUntil = null WHERE m.status = 'SUSPENDED' AND m.suspendedUntil <= :now")
    int liftExpiredSuspensions(@org.springframework.data.repository.query.Param("now") java.time.LocalDateTime now);
}