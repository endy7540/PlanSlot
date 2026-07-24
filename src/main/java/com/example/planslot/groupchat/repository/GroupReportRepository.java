package com.example.planslot.groupchat.repository;

import com.example.planslot.groupchat.entity.GroupReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupReportRepository extends JpaRepository<GroupReport, Long> {
}
