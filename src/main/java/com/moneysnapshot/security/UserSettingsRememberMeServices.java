package com.moneysnapshot.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.rememberme.TokenBasedRememberMeServices;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class UserSettingsRememberMeServices extends TokenBasedRememberMeServices {

    private static final String REMEMBER_ME_KEY = "money-snapshot-remember-me";
    private static final String REMEMBER_ME_PARAMETER = "remember-me";

    private final int rememberMeDays;

    public UserSettingsRememberMeServices(
            AppUserDetailsService userDetailsService,
            @Value("${app.security.remember-me-days:30}") int rememberMeDays
    ) {
        super(REMEMBER_ME_KEY, userDetailsService);
        this.rememberMeDays = normalizeRememberMeDays(rememberMeDays);
        setParameter(REMEMBER_ME_PARAMETER);
        setTokenValiditySeconds(this.rememberMeDays * 24 * 60 * 60);
    }

    @Override
    protected int calculateLoginLifetime(HttpServletRequest request, Authentication authentication) {
        return rememberMeDays * 24 * 60 * 60;
    }

    private int normalizeRememberMeDays(int value) {
        return value >= 1 && value <= 365 ? value : 30;
    }
}
