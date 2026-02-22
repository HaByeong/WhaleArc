package com.project.whalearc.auth.login.repository.userinfo;

import com.project.whalearc.auth.login.domain.userinfo.UserInfo;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;


@Repository
public interface UserInfoRepository extends MongoRepository<UserInfo, String> {

    UserInfo findByUserId(String userId);
}
