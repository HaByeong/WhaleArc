package com.project.whalearc;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WhalearcApplication {

	public static void main(String[] args) {
		SpringApplication.run(WhalearcApplication.class, args);
	}

}
