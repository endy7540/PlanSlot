package com.example.planslot.member.repository;

import com.example.planslot.member.entity.AuthToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuthTokenRepository extends JpaRepository<AuthToken, Long> {
    Optional<AuthToken> findByRefreshToken(String refreshToken);

    void deleteByMemberId(Long memberId);
}
