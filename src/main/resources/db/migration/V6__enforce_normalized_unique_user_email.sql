create unique index if not exists uq_app_users_email_normalized
    on app_users ((lower(btrim(email))));
