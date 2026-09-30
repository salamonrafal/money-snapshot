package com.moneysnapshot.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.rememberme.CookieTheftException;
import org.springframework.security.web.authentication.rememberme.PersistentTokenBasedRememberMeServices;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;

public class UserSettingsRememberMeServices extends PersistentTokenBasedRememberMeServices {

    private static final String REMEMBER_ME_PARAMETER = "remember-me";
    private static final int DEFAULT_REMEMBER_ME_DAYS = 30;

    private final int rememberMeDays;

    public UserSettingsRememberMeServices(
            AppUserDetailsService userDetailsService,
            PersistentTokenRepository persistentTokenRepository,
            String rememberMeKey,
            int rememberMeDays
    ) {
        super(requireRememberMeKey(rememberMeKey), userDetailsService, persistentTokenRepository);
        this.rememberMeDays = normalizeRememberMeDays(rememberMeDays);
        setParameter(REMEMBER_ME_PARAMETER);
        setTokenValiditySeconds(this.rememberMeDays * 24 * 60 * 60);
    }

    private int normalizeRememberMeDays(int value) {
        return value >= 1 && value <= 365 ? value : DEFAULT_REMEMBER_ME_DAYS;
    }

    private static String requireRememberMeKey(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing required configuration: app.security.remember-me-key");
        }

        return value.trim();
    }

    @Override
    public Authentication autoLogin(HttpServletRequest request, HttpServletResponse response) {
        try {
            return super.autoLogin(request, response);
        } catch (CookieTheftException exception) {
            // A concurrent request can legitimately present the token just rotated
            // by another request. Invalidate the stale cookie and continue as logged out.
            cancelCookie(request, response);
            return null;
        }
    }
}
