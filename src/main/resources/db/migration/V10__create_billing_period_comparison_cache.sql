create table report_billing_period_comparison_cache (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    period_index integer not null,
    period_start_date date not null,
    period_end_date date not null,
    reference_start_date date not null,
    reference_end_date date not null,
    currency_code char(3) not null,
    period_change numeric(38, 4) not null,
    reference_change numeric(38, 4) not null,
    difference numeric(38, 4) not null,
    difference_percent numeric(38, 4),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_report_billing_period_comparison_cache unique (owner_id, period_index, currency_code),
    constraint ck_report_billing_period_comparison_index check (period_index between 1 and 6)
);

create index idx_report_billing_period_comparison_cache_owner_period
    on report_billing_period_comparison_cache (owner_id, period_index);

alter table report_cache_refresh_state
    add column billing_period_comparison_ready boolean not null default false;
