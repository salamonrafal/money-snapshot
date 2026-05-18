# Money Snapshot

Store and visualize financial changes across your accounts.

## Stack

- Java 17
- Spring Boot 3
- Maven
- PostgreSQL
- Flyway database migrations
- CSS and plain JavaScript frontend

## Local run

Start PostgreSQL and create a database named `money_snapshot`.

## Docker Compose

The repository includes a Docker Compose setup with:

- `web` - Spring Boot application started with Maven.
- `postgres` - PostgreSQL from the pinned `postgres:18.4` image, exposed on the host as `localhost:5455`.
- `money-snapshot-postgres-data` - persistent PostgreSQL data volume.
- `money-snapshot-maven-cache` - Maven dependency cache volume.
- `money-snapshot-maven-target` - Maven build output volume, mounted at `/app/target` so Docker does not create root-owned `target/` files in the working tree.

Create a local `.env` file before starting Docker Compose:

```bash
cp .env.example .env
```

Then edit `.env` and set the local database credentials. The `.env` file is ignored by Git and should not be committed.

Start the full stack:

```bash
docker compose up
```

Start it in the background:

```bash
docker compose up -d
```

Open the application at `http://localhost:5081`.

PostgreSQL is available from the host at:

```text
host: localhost
port: 5455
database: value from APP_DB_NAME in .env
user: value from DB_USERNAME in .env
password: value from DB_PASSWORD in .env
```

Inside the Docker network, the application connects to PostgreSQL at `postgres:5432`.

To create the first administrator during startup:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='change-this-password' docker compose up
```

Common management commands:

```bash
docker compose ps
docker compose logs -f
docker compose logs -f web
docker compose logs -f postgres
docker compose stop
docker compose start
docker compose down
```

Rebuild/recreate containers after configuration changes:

```bash
docker compose up -d --force-recreate
```

Remove containers and the PostgreSQL data volume:

```bash
docker compose down -v
```

Use `docker compose down -v` only when you want to delete the local database data. PostgreSQL initialization scripts run only when the `money-snapshot-postgres-data` volume is created for the first time.

PostgreSQL first-run initialization is configured under `docker/postgres`. The init script reads `docker/postgres/sql/001_create_database_and_user.sql`, creates the `money_snapshot` database and user, and grants privileges required by the application and Flyway migrations.

Docker Compose pins the database image to `postgres:18.4`, a specific official Postgres image tag known to work with this local setup. Update the image tag intentionally rather than switching to `latest`. Treat any major-version change as a database upgrade: create a dump or backup first, update the image tag, then recreate and restore the local volume as needed.

For PostgreSQL 18, the official image stores `PGDATA` in a version-specific child directory under `/var/lib/postgresql`, for example `/var/lib/postgresql/18/docker`. The Compose volume is mounted at `/var/lib/postgresql` intentionally so the named volume contains the active `PGDATA` directory used by this image line.

The PostgreSQL healthcheck probes the admin database configured by `POSTGRES_DB` and `POSTGRES_USER`. This checks server readiness without depending on the application database or application user during first-run initialization.

### Docker Compose database backup and restore

Create a database dump before deleting the PostgreSQL volume:

```bash
docker compose exec -T postgres sh -c \
  'app_db_name="${APP_DB_NAME:-${DB_URL##*/}}"; app_db_name="${app_db_name%%\?*}"; pg_dump -U "$DB_USERNAME" -d "$app_db_name" --format=custom' \
  > money_snapshot.dump
```

The `money_snapshot.dump` file is created in the project directory on the host.

Remove containers and the PostgreSQL data volume:

```bash
docker compose down -v
```

Start PostgreSQL again so Docker Compose creates a fresh database volume and runs the first-run initialization:

```bash
docker compose up -d postgres
```

Restore the dump:

```bash
docker compose exec -T postgres sh -c \
  'app_db_name="${APP_DB_NAME:-${DB_URL##*/}}"; app_db_name="${app_db_name%%\?*}"; pg_restore -U postgres -d "$app_db_name" --clean --if-exists' \
  < money_snapshot.dump
```

The restore uses the administrative `postgres` role because the dump can contain ownership and default-privilege statements for that role. Restoring the same dump as the application user can fail with `permission denied to change default privileges`.

Start the full stack after the restore:

```bash
docker compose up -d
```

Make sure the dump file is stored on the host before running `docker compose down -v`. Files stored only inside containers are removed with the containers.

## Database setup

The administrative SQL script is in `docker/postgres/sql/001_create_database_and_user.sql`.

The Docker init script runs it with `psql` and passes `app_database`, `app_user`, and `app_password` variables from `.env`. Run the file with `psql` as a PostgreSQL administrator if you need to apply it manually; it uses `psql` variables and `\gexec`, so it is not compatible with pgAdmin Query Tool as-is.

For pgAdmin, use the compatible script in `database/001_create_database_and_user.sql`, or run equivalent literal SQL. Replace `<application-database-password>` with the password selected for the local application database before running it.

1. Open Query Tool connected to an administrative database, for example `postgres`.
2. Create the application role and database:

```sql
create user money_snapshot with password '<application-database-password>';
create database money_snapshot with owner = money_snapshot encoding = 'UTF8' connection limit = -1;
```

3. Reconnect Query Tool to the new `money_snapshot` database.
4. Grant privileges:

```sql
grant connect on database money_snapshot to money_snapshot;
grant usage, create on schema public to money_snapshot;
grant all privileges on all tables in schema public to money_snapshot;
grant all privileges on all sequences in schema public to money_snapshot;

alter default privileges in schema public
    grant all privileges on tables to money_snapshot;

alter default privileges in schema public
    grant all privileges on sequences to money_snapshot;
```

The script creates:

- database `money_snapshot`
- user `money_snapshot`
- password selected by the local operator
- privileges required by the application and Flyway migrations

The initial application schema is defined by Flyway migrations in `src/main/resources/db/migration`.
The first migration is `V1__create_money_snapshot_schema.sql` and creates the base tables for users, roles, banks, accounts, and account snapshots.

Provide credentials through environment variables if they differ from defaults:

```bash
export DB_URL=jdbc:postgresql://localhost:5432/money_snapshot
export APP_DB_NAME=money_snapshot
export DB_USERNAME=money_snapshot
export DB_PASSWORD='<application-database-password>'
```

Alternatively, create a local `.env` file in the project root. It is loaded automatically when present:

```properties
DB_URL=jdbc:postgresql://localhost:5432/money_snapshot
APP_DB_NAME=money_snapshot
DB_USERNAME=money_snapshot
DB_PASSWORD=<application-database-password>
SERVER_PORT=5081
```

## Create the first administrator

The panel is available only after login. To create the first administrator automatically, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first application start:

```bash
export ADMIN_EMAIL=admin@example.com
export ADMIN_PASSWORD='change-this-password'
mvn spring-boot:run
```

Optional administrator name variables:

```bash
export ADMIN_FIRST_NAME=Admin
export ADMIN_LAST_NAME=User
```

The application creates the administrator only when a user with `ADMIN_EMAIL` does not already exist. The password is stored as a BCrypt hash. After the account is created, remove `ADMIN_PASSWORD` from your shell or `.env` file and manage users from `/users.html`.

## Run migrations

Flyway runs automatically when the Spring Boot application starts. It reads migrations from `src/main/resources/db/migration` and applies pending scripts to the database configured by `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`.

To run migrations without starting the web application, use the Flyway Maven plugin:

```bash
mvn org.flywaydb:flyway-maven-plugin:migrate \
  -Dflyway.url=jdbc:postgresql://localhost:5432/money_snapshot \
  -Dflyway.user=money_snapshot \
  -Dflyway.password=money_snapshot \
  -Dflyway.locations=filesystem:src/main/resources/db/migration
```

Flyway records applied migrations in the `flyway_schema_history` table. Existing migrations should not be edited after they have been applied to a shared database; create a new `V{number}__description.sql` file instead.

## Run the application

After creating the database and application user, start the application:

```bash
mvn spring-boot:run
```

Open `http://localhost:5081`.

## IDE launch

For Eclipse on Windows, import the project as an existing Maven project and run `MoneySnapshot.launch`.

## Project layout

- `src/main/java/com/moneysnapshot` - Spring Boot application code.
- `src/main/resources/db/migration` - Flyway migrations.
- `src/main/resources/static` - frontend assets served by Spring Boot.
- `src/main/resources/messages*.properties` - application translations.
