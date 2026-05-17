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
- `postgres` - PostgreSQL exposed on the host as `localhost:5455`.
- `money-snapshot-postgres-data` - persistent PostgreSQL data volume.
- `money-snapshot-maven-cache` - Maven dependency cache volume.

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
database: value from DB_URL in .env
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

The Compose file uses `postgres:latest`. PostgreSQL 18+ expects the persistent volume to be mounted at `/var/lib/postgresql`, not `/var/lib/postgresql/data`. If Docker reports old data in `/var/lib/postgresql/data`, you are using a volume created with an older image layout. For a local database that can be deleted, run:

```bash
docker compose down -v
docker compose up
```

If the old volume contains data you need, create a dump with the older PostgreSQL image before deleting the volume, then restore it into the fresh volume.

### Docker Compose database backup and restore

Create a database dump before deleting the PostgreSQL volume:

```bash
docker compose exec -T postgres pg_dump \
  -U money_snapshot \
  -d money_snapshot \
  --format=custom \
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
docker compose exec -T postgres pg_restore \
  -U postgres \
  -d money_snapshot \
  --clean \
  --if-exists \
  < money_snapshot.dump
```

The restore uses the administrative `postgres` role because the dump can contain ownership and default-privilege statements for that role. Restoring the same dump as `money_snapshot` can fail with `permission denied to change default privileges`.

Start the full stack after the restore:

```bash
docker compose up -d
```

Make sure the dump file is stored on the host before running `docker compose down -v`. Files stored only inside containers are removed with the containers.

## Database setup

The administrative SQL script is in `database/001_create_database_and_user.sql`.

Use it in pgAdmin as a PostgreSQL administrator, for example `postgres`:

1. Open Query Tool connected to an administrative database, for example `postgres`.
2. Run section `Section 1: database and application user`.
3. Reconnect Query Tool to the new `money_snapshot` database.
4. Run section `Section 2: run after reconnecting Query Tool to the money_snapshot database`.

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
export DB_USERNAME=money_snapshot
export DB_PASSWORD='<application-database-password>'
```

Alternatively, create a local `.env` file in the project root. It is loaded automatically when present:

```properties
DB_URL=jdbc:postgresql://localhost:5432/money_snapshot
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
