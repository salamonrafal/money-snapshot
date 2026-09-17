create table report_retirement_account_cache (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    retirement_account_id uuid not null references retirement_accounts (id) on delete cascade,
    account_type_code varchar(40) not null,
    institution varchar(120) not null,
    currency_code char(3) not null,
    balance numeric(19, 4) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_report_retirement_account_cache unique (owner_id, retirement_account_id)
);

create index idx_report_retirement_account_cache_owner
    on report_retirement_account_cache (owner_id);
