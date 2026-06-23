create table counterparties (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    name varchar(180) not null,
    normalized_name varchar(180) not null,
    bank_account_number varchar(64) not null,
    address varchar(500),
    note varchar(500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_counterparties_owner_normalized_name unique (owner_id, normalized_name)
);

create index idx_counterparties_owner_id
    on counterparties (owner_id);

create table bills (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    counterparty_id uuid not null references counterparties (id),
    account_id uuid not null references accounts (id),
    name varchar(120) not null,
    normalized_name varchar(120) not null,
    currency_code char(3) not null references currencies (code),
    amount numeric(19, 4) not null,
    duration_type varchar(40) not null,
    end_date date,
    installment_count integer,
    repayment_day integer not null,
    start_from date not null,
    status varchar(20) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_bills_owner_normalized_name unique (owner_id, normalized_name),
    constraint chk_bills_amount_positive check (amount > 0),
    constraint chk_bills_repayment_day check (repayment_day between 1 and 31),
    constraint chk_bills_duration_type check (duration_type in ('UNTIL_DATE', 'INSTALLMENTS', 'OPEN_ENDED')),
    constraint chk_bills_status check (status in ('ACTIVE', 'SUSPENDED', 'COMPLETED')),
    constraint chk_bills_installment_count_positive check (installment_count is null or installment_count > 0)
);

create index idx_bills_owner_id
    on bills (owner_id);

create index idx_bills_account_id
    on bills (account_id);

create index idx_bills_counterparty_id
    on bills (counterparty_id);

create index idx_bills_owner_status
    on bills (owner_id, status);

create table bill_schedule_entries (
    id uuid primary key,
    owner_id uuid not null references app_users (id) on delete cascade,
    bill_id uuid not null references bills (id) on delete cascade,
    installment_number integer not null,
    due_date date not null,
    amount numeric(19, 4) not null,
    currency_code char(3) not null references currencies (code),
    paid boolean not null default false,
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_bill_schedule_entries_bill_installment unique (bill_id, installment_number),
    constraint chk_bill_schedule_entries_installment_positive check (installment_number > 0),
    constraint chk_bill_schedule_entries_amount_positive check (amount > 0)
);

create index idx_bill_schedule_entries_owner_id
    on bill_schedule_entries (owner_id);

create index idx_bill_schedule_entries_bill_due_date
    on bill_schedule_entries (bill_id, due_date, installment_number);
