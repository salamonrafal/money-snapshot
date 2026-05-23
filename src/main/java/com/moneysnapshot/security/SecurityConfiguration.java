package com.moneysnapshot.security;

import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.rememberme.JdbcTokenRepositoryImpl;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfiguration {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, UserSettingsRememberMeServices rememberMeServices) throws Exception {
        return http
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/css/**", "/js/**").permitAll()
                        .requestMatchers("/login", "/api/login/messages").permitAll()
                        .requestMatchers("/api/users/me", "/api/users/me/settings").authenticated()
                        .requestMatchers("/users.html", "/users/**", "/api/users/**", "/api/roles").hasRole(Role.ADMINISTRATOR)
                        .anyRequest().authenticated()
                )
                .formLogin(form -> form
                        .loginPage("/login")
                        .defaultSuccessUrl("/", true)
                        .permitAll()
                )
                .rememberMe(rememberMe -> rememberMe
                        .rememberMeServices(rememberMeServices)
                )
                .logout(logout -> logout.logoutSuccessUrl("/login?logout").permitAll())
                .csrf(csrf -> csrf.disable())
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    PersistentTokenRepository persistentTokenRepository(DataSource dataSource) {
        JdbcTokenRepositoryImpl repository = new JdbcTokenRepositoryImpl();
        repository.setDataSource(dataSource);
        return repository;
    }

    @Bean
    UserSettingsRememberMeServices userSettingsRememberMeServices(
            AppUserDetailsService userDetailsService,
            PersistentTokenRepository persistentTokenRepository,
            @org.springframework.beans.factory.annotation.Value("${app.security.remember-me-key:}") String rememberMeKey,
            @org.springframework.beans.factory.annotation.Value("${app.security.remember-me-days:30}") int rememberMeDays
    ) {
        return new UserSettingsRememberMeServices(
                userDetailsService,
                persistentTokenRepository,
                rememberMeKey,
                rememberMeDays
        );
    }
}
