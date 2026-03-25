package com.project.whalearc.virt.repository;

import com.project.whalearc.virt.domain.VirtCredential;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VirtCredentialRepository extends MongoRepository<VirtCredential, String> {
    Optional<VirtCredential> findByUserId(String userId);
    void deleteByUserId(String userId);
}
