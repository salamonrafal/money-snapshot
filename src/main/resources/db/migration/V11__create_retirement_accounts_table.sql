create table retirement_accounts (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    account_type_code varchar(40) not null,
    institution varchar(120) not null,
    name varchar(120) not null,
    normalized_name varchar(120) not null,
    website_url varchar(2048),
    currency_code char(3) not null default 'PLN',
    balance numeric(19, 4) not null,
    monthly_contribution numeric(19, 4) not null default 0,
    balance_updated_at date not null,
    status varchar(20) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_retirement_accounts_owner_normalized_name unique (owner_id, normalized_name),
    constraint chk_retirement_accounts_status check (status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),
    constraint chk_retirement_accounts_balance_nonnegative check (balance >= 0),
    constraint chk_retirement_accounts_monthly_contribution_nonnegative check (monthly_contribution >= 0)
);

create index idx_retirement_accounts_owner_id
    on retirement_accounts (owner_id);

create index idx_retirement_accounts_owner_status
    on retirement_accounts (owner_id, status);

create table retirement_account_contributions (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    retirement_account_id uuid not null references retirement_accounts (id) on delete cascade,
    contribution_date date not null,
    amount numeric(19, 4) not null,
    previous_balance numeric(19, 4) not null,
    current_balance numeric(19, 4) not null,
    note varchar(500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_retirement_account_contributions_amount_positive check (amount > 0),
    constraint chk_retirement_account_contributions_previous_balance_nonnegative check (previous_balance >= 0),
    constraint chk_retirement_account_contributions_current_balance_nonnegative check (current_balance >= 0),
    constraint chk_retirement_account_contributions_balance_delta check (current_balance - previous_balance = amount)
);

create index idx_retirement_account_contributions_owner_id
    on retirement_account_contributions (owner_id);

create index idx_retirement_account_contributions_account_date
    on retirement_account_contributions (retirement_account_id, contribution_date desc);
