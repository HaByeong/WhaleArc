package com.project.whalearc.user.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String supabaseId;

    private String email;

    private String name;

    private String authProvider; // "email", "google", "kakao"

    public User(String supabaseId, String email, String name, String authProvider) {
        this.supabaseId = supabaseId;
        this.email = email;
        this.name = name;
        this.authProvider = authProvider;
    }
}
