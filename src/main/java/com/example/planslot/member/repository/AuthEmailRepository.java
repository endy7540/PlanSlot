package com.example.planslot.member.repository;

import com.example.planslot.member.entity.AuthEmail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuthEmailRepository extends JpaRepository<AuthEmail, Long> {
    Optional<AuthEmail> findTopByEmailOrderByCreatedAtDesc(String email);
}//
