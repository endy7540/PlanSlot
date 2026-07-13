package com.example.planslot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@EnableJpaAuditing
@SpringBootApplication
public class PlanSlotApplication {

    public static void main(String[] args) {
        SpringApplication.run(PlanSlotApplication.class, args);
    }

}
