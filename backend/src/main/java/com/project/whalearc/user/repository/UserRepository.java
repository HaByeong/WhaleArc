package com.project.whalearc.user.repository;

import com.project.whalearc.user.domain.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findBySupabaseId(String supabaseId);

    boolean existsBySupabaseId(String supabaseId);

    Optional<User> findByEmail(String email);

    List<User> findAllBySupabaseIdIn(Collection<String> supabaseIds);
}
