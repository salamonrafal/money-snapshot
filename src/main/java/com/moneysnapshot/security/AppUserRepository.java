package com.moneysnapshot.security;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
    @Query("select user from AppUser user where lower(trim(user.email)) = lower(trim(:email))")
    Optional<AppUser> findByNormalizedEmail(@Param("email") String email);

    @Query("select count(user) > 0 from AppUser user where lower(trim(user.email)) = lower(trim(:email))")
    boolean existsByNormalizedEmail(@Param("email") String email);

    List<AppUser> findAllByOrderByEmail();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from AppUser user where user.id = :id")
    Optional<AppUser> findByIdForUpdate(@Param("id") UUID id);
}
