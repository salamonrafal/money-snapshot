alter table accounts
    add column forecasted_monthly_contribution numeric(19, 2);

create table savings_forecast_runs (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    forecast_start_date date not null,
    duration_months integer not null,
    generated_at timestamptz not null
);

create index idx_savings_forecast_runs_owner_generated_at
    on savings_forecast_runs (owner_id, generated_at desc);

create table savings_forecast_entries (
    id uuid primary key,
    run_id uuid not null references savings_forecast_runs (id) on delete cascade,
    account_id uuid not null references accounts (id) on delete cascade,
    starting_balance numeric(19, 4) not null,
    forecasted_monthly_contribution numeric(19, 2) not null,
    projected_balance numeric(19, 4) not null,
    latest_snapshot_date date,
    constraint uq_savings_forecast_entries_run_account unique (run_id, account_id)
);

create index idx_savings_forecast_entries_run_id
    on savings_forecast_entries (run_id);

create table savings_forecast_month_values (
    id uuid primary key,
    entry_id uuid not null references savings_forecast_entries (id) on delete cascade,
    forecast_month date not null,
    balance numeric(19, 4) not null,
    constraint uq_savings_forecast_month_values_entry_month unique (entry_id, forecast_month)
);

create index idx_savings_forecast_month_values_entry_id
    on savings_forecast_month_values (entry_id);

create table savings_forecast_month_summaries (
    id uuid primary key,
    run_id uuid not null references savings_forecast_runs (id) on delete cascade,
    forecast_month date not null,
    currency_code varchar(3) not null,
    total_balance numeric(19, 4) not null,
    constraint uq_savings_forecast_month_summaries_run_month_currency unique (run_id, forecast_month, currency_code)
);

create index idx_savings_forecast_month_summaries_run_id
    on savings_forecast_month_summaries (run_id);
