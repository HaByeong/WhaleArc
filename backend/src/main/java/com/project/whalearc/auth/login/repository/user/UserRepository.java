package com.project.whalearc.auth.login.repository.user;

import com.project.whalearc.auth.login.domain.user.User;
import com.project.whalearc.auth.login.dto.auth.RepositoryPasswordReturnDto;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

//비밀번호 가져와서 비교 후 로그인 성공 시 User 객체 전체가 필요하다(로그인 유저)
//<User, String> -> 제네릭의 의미는 User 부분: 어떤 컬렉션과 연결할지 결정, String 부분: _id의 타입
@Repository
public interface UserRepository extends MongoRepository<User, String>{
    // User 문서에서 비밀번호(password)만 조회를 원함
    // @Query로 MongoDB 쿼리 직접 작성: _id 필드로 검색해서, password 필드를 가져온다.
    // value = "{'_id' : ?0}" => 이건 MongoDB로 치면, db.users.findOne({_id: userId})
    // ?0의 의미: 첫 번째 파라미터(ex: findOnlyPasswordById("abc123") => {_id: "abc123"})

    //fields = "{'password' : 1, '_id' : 0}" => 몽고디비는 기본적으로 _id를 항상 포함하기 때문에 0으로 제외시키고, password만 1로 포함시킴

    @Query(value = "{'_id' : ?0}", fields = "{'password' : 1, '_id': 0}")
    RepositoryPasswordReturnDto findOnlyPasswordById(String userId);

    User findByUserId(String userId);


    // Spring Data가 메서드 이름을 분석해서 자동 쿼리 생성:
    //   existsBy + UserId → db.users.count({userId: "xxx"}) > 0 ? true : false
    //
    // 이게 없으면 같은 userId로 가입 시 MongoDB의 _id가 같아서
    // 기존 유저 데이터가 덮어씌워짐 (비밀번호, 이름 전부 새 값으로 교체)
    // → 다른 사람이 내 아이디로 가입하면 내 계정을 탈취할 수 있음
    boolean existsByUserId(String userId);
}
