-- Run this script in pgAdmin as a PostgreSQL administrator, for example the
-- postgres user. PgAdmin does not support psql commands such as \connect, so:
--
-- 1. Run section 1 while connected to an administrative database, for example
--    postgres.
-- 2. Reconnect Query Tool to the money_snapshot database.
-- 3. Run section 2.
--
-- The credentials match the default Spring Boot configuration:
-- DB_URL=jdbc:postgresql://localhost:5432/money_snapshot
-- DB_USERNAME=money_snapshot
-- DB_PASSWORD=money_snapshot

-- Section 1: database and application user.

do
$$
begin
    if not exists (
        select 1
        from pg_catalog.pg_roles
        where rolname = 'money_snapshot'
    ) then
        create user money_snapshot with password 'money_snapshot';
    end if;
end
$$;

create database money_snapshot
    with
    owner = money_snapshot
    encoding = 'UTF8'
    connection limit = -1;

-- Section 2: run after reconnecting Query Tool to the money_snapshot database.

grant connect on database money_snapshot to money_snapshot;
grant usage, create on schema public to money_snapshot;
grant all privileges on all tables in schema public to money_snapshot;
grant all privileges on all sequences in schema public to money_snapshot;

alter default privileges in schema public
    grant all privileges on tables to money_snapshot;

alter default privileges in schema public
    grant all privileges on sequences to money_snapshot;
