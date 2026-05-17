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
- password `money_snapshot`
- privileges required by the application and Flyway migrations

The initial application schema is defined by Flyway migrations in `src/main/resources/db/migration`.
The first migration is `V1__create_money_snapshot_schema.sql` and creates the base tables for users, roles, banks, accounts, and account snapshots.

Provide credentials through environment variables if they differ from defaults:

```bash
export DB_URL=jdbc:postgresql://localhost:5432/money_snapshot
export DB_USERNAME=money_snapshot
export DB_PASSWORD=money_snapshot
```

Alternatively, create a local `.env` file in the project root. It is loaded automatically when present:

```properties
DB_URL=jdbc:postgresql://localhost:5432/money_snapshot
DB_USERNAME=money_snapshot
DB_PASSWORD=money_snapshot
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
