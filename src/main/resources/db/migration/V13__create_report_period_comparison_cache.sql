create table report_period_comparison_cache (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    period_index integer not null,
    period_start_date date not null,
    period_end_date date not null,
    point_date date not null,
    currency_code char(3) not null,
    amount numeric(38, 4) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_report_period_comparison_cache unique (owner_id, period_index, point_date, currency_code),
    constraint ck_report_period_comparison_index check (period_index between 0 and 6)
);

create index idx_report_period_comparison_cache_owner_period
    on report_period_comparison_cache (owner_id, period_index, point_date);

alter table report_cache_refresh_state
    add column period_comparison_ready boolean not null default false;
