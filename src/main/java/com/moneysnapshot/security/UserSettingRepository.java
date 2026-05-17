package com.moneysnapshot.security;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

public interface UserSettingRepository extends JpaRepository<UserSetting, UUID> {
    List<UserSetting> findAllByUserId(UUID userId);
    Optional<UserSetting> findByUserIdAndKey(UUID userId, String key);

    @Modifying
    long deleteByUserId(UUID userId);
}
