package com.oms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EnableJpaAuditing
@EnableJpaRepositories(basePackages = "com.oms")
@EntityScan(basePackages = "com.oms")
public class OmsApplication {

    public static void main(String[] args) {
        // Disable DevTools restart to avoid classloader conflicts during local incremental compilation.
        System.setProperty("spring.devtools.restart.enabled", "false");
        SpringApplication.run(OmsApplication.class, args);
    }
}
