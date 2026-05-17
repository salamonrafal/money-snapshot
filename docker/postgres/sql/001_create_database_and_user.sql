-- Run this script in pgAdmin as a PostgreSQL administrator, for example the
-- postgres user. PgAdmin does not support psql commands such as \connect, so:
--
-- 1. Run section 1 while connected to an administrative database, for example
--    postgres.
-- 2. Reconnect Query Tool to the money_snapshot database.
-- 3. Run section 2.
--
-- The Docker init script passes database, user, and password values from .env
-- as psql variables: app_database, app_user, and app_password.

-- Section 1: database and application user.

select format('create user %I with password %L', :'app_user', :'app_password')
where not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = :'app_user'
)
\gexec

select format(
    'create database %I with owner = %I encoding = %L connection limit = -1',
    :'app_database',
    :'app_user',
    'UTF8'
)
where not exists (
    select 1
    from pg_catalog.pg_database
    where datname = :'app_database'
)
\gexec

-- Section 2: run after reconnecting Query Tool to the money_snapshot database.

grant connect on database :"app_database" to :"app_user";
grant usage, create on schema public to :"app_user";
grant all privileges on all tables in schema public to :"app_user";
grant all privileges on all sequences in schema public to :"app_user";

alter default privileges in schema public
    grant all privileges on tables to :"app_user";

alter default privileges in schema public
    grant all privileges on sequences to :"app_user";
