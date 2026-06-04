create table report_daily_balance_cache (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    account_id uuid not null references accounts (id) on delete cascade,
    bank_id uuid not null references banks (id) on delete cascade,
    balance_date date not null,
    latest_snapshot_date date not null,
    account_name varchar(120) not null,
    bank_name varchar(120) not null,
    currency_code char(3) not null,
    balance numeric(19, 4) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_report_daily_balance_cache unique (owner_id, account_id, balance_date)
);

create index idx_report_daily_balance_cache_owner_date
    on report_daily_balance_cache (owner_id, balance_date);

create index idx_report_daily_balance_cache_owner_bank_date
    on report_daily_balance_cache (owner_id, bank_id, balance_date);

create table report_average_contribution_cache (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    account_id uuid not null references accounts (id) on delete cascade,
    bank_id uuid not null references banks (id) on delete cascade,
    account_name varchar(120) not null,
    bank_name varchar(120) not null,
    currency_code char(3) not null,
    average_contribution numeric(19, 4) not null,
    sample_from_date date not null,
    sample_to_date date not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_report_average_contribution_cache unique (owner_id, account_id)
);

create index idx_report_average_contribution_cache_owner
    on report_average_contribution_cache (owner_id);

create table report_cache_refresh_state (
    owner_id uuid primary key references app_users (id) on delete cascade,
    dirty boolean not null default true,
    refresh_requested_at timestamptz not null default now(),
    refreshed_at timestamptz,
    last_error varchar(1000)
);

create table report_final_snapshot_cache (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    account_id uuid not null references accounts (id) on delete cascade,
    bank_id uuid not null references banks (id) on delete cascade,
    snapshot_date date not null,
    account_name varchar(120) not null,
    bank_name varchar(120) not null,
    currency_code char(3) not null,
    balance numeric(19, 4) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_report_final_snapshot_cache unique (owner_id, account_id, snapshot_date)
);

create index idx_report_final_snapshot_cache_owner_date
    on report_final_snapshot_cache (owner_id, snapshot_date);
