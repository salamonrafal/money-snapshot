-- Run this script with psql as a PostgreSQL administrator, for example the
-- postgres user. It uses psql variables and \gexec, so it is not compatible
-- with pgAdmin Query Tool as-is.
--
-- 1. Run section 1 with psql connected to an administrative database, for
--    example postgres.
-- 2. Reconnect psql to the application database.
-- 3. Run section 2.
--
-- The Docker init script passes database, user, and password values from .env
-- as psql variables: app_database, app_user, and app_password. The database
-- value comes from APP_DB_NAME, falling back to the database segment of DB_URL.

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

-- Section 2: run after reconnecting psql to the application database.

grant connect on database :"app_database" to :"app_user";
grant usage, create on schema public to :"app_user";
grant all privileges on all tables in schema public to :"app_user";
grant all privileges on all sequences in schema public to :"app_user";

alter default privileges in schema public
    grant all privileges on tables to :"app_user";

alter default privileges in schema public
    grant all privileges on sequences to :"app_user";
