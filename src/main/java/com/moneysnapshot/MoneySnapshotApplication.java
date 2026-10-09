package com.moneysnapshot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(ApplicationEnvironmentProperties.class)
public class MoneySnapshotApplication {

    public static void main(String[] args) {
        SpringApplication.run(MoneySnapshotApplication.class, args);
    }
}
