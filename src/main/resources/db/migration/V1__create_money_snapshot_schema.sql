create table currencies (
    code char(3) primary key,
    name varchar(80) not null,
    created_at timestamptz not null default now()
);

create table account_types (
    code varchar(40) primary key,
    name varchar(80) not null,
    created_at timestamptz not null default now()
);

create table roles (
    id uuid primary key,
    code varchar(40) not null,
    name varchar(80) not null,
    created_at timestamptz not null default now(),
    constraint uq_roles_code unique (code)
);

create table app_users (
    id uuid primary key,
    email varchar(180) not null,
    first_name varchar(120) not null,
    last_name varchar(120) not null,
    description varchar(500),
    role_id uuid not null references roles (id),
    status varchar(20) not null,
    password_hash varchar(120) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_app_users_email unique (email),
    constraint chk_app_users_status check (status in ('ACTIVE', 'SUSPENDED'))
);

create table user_settings (
    id uuid primary key,
    user_id uuid not null references app_users (id) on delete cascade,
    setting_key varchar(120) not null,
    setting_value varchar(1000) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_user_settings_key unique (user_id, setting_key)
);

create table banks (
    id uuid primary key,
    owner_id uuid references app_users (id),
    name varchar(120) not null,
    normalized_name varchar(120) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_banks_owner_normalized_name unique (owner_id, normalized_name)
);

create table accounts (
    id uuid primary key,
    owner_id uuid references app_users (id),
    bank_id uuid not null references banks (id),
    name varchar(120) not null,
    normalized_name varchar(120) not null,
    account_type_code varchar(40) not null,
    currency_code char(3) not null,
    description varchar(500),
    status varchar(20) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint fk_accounts_account_type foreign key (account_type_code) references account_types (code),
    constraint fk_accounts_currency foreign key (currency_code) references currencies (code),
    constraint uq_accounts_owner_normalized_name unique (owner_id, normalized_name),
    constraint chk_accounts_status check (status in ('ACTIVE', 'CLOSED', 'SUSPENDED'))
);

create table account_snapshots (
    id uuid primary key,
    owner_id uuid references app_users (id),
    account_id uuid not null references accounts (id),
    snapshot_date date not null,
    balance numeric(19, 4) not null,
    note varchar(500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_account_snapshot_date unique (account_id, snapshot_date)
);

create index idx_account_snapshots_account_date
    on account_snapshots (account_id, snapshot_date desc);

create index idx_accounts_bank_id
    on accounts (bank_id);

create index idx_banks_owner_id
    on banks (owner_id);

create index idx_accounts_owner_id
    on accounts (owner_id);

create index idx_account_snapshots_owner_id
    on account_snapshots (owner_id);

create index idx_user_settings_user_id
    on user_settings (user_id);

create index idx_accounts_account_type_code
    on accounts (account_type_code);

create index idx_accounts_currency_code
    on accounts (currency_code);

insert into currencies (code, name)
values
    ('PLN', 'Polish Zloty'),
    ('EUR', 'Euro'),
    ('USD', 'US Dollar');

insert into account_types (code, name)
values
    ('BANK_ACCOUNT', 'Bank Account'),
    ('CASH', 'Cash'),
    ('SAVINGS', 'Savings'),
    ('INVESTMENT', 'Investment');

insert into roles (id, code, name)
values
    ('00000000-0000-0000-0000-000000000101', 'ADMINISTRATOR', 'Administrator'),
    ('00000000-0000-0000-0000-000000000102', 'USER', 'User');

insert into banks (id, name, normalized_name)
values ('00000000-0000-0000-0000-000000000001', 'Unknown bank', 'unknown-bank');
