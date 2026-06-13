create table liabilities (
    id uuid primary key,
    owner_id uuid not null references app_users (id),
    bank_id uuid not null references banks (id),
    name varchar(120) not null,
    normalized_name varchar(120) not null,
    liability_type_code varchar(40) not null,
    currency_code char(3) not null,
    original_amount numeric(19, 4) not null,
    current_amount numeric(19, 4) not null,
    installment_amount numeric(19, 4),
    credit_card_limit numeric(19, 4),
    credit_card_minimum_payment numeric(19, 4),
    repayment_start_date date,
    end_date date,
    installment_count integer,
    first_repayment_day integer,
    schedule_mode_code varchar(40),
    note varchar(500),
    status varchar(20) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_liabilities_owner_normalized_name unique (owner_id, normalized_name),
    constraint chk_liabilities_status check (status in ('ACTIVE', 'COMPLETED', 'SUSPENDED')),
    constraint chk_liabilities_first_repayment_day check (first_repayment_day is null or first_repayment_day between 1 and 31),
    constraint chk_liabilities_original_amount_nonnegative check (original_amount >= 0),
    constraint chk_liabilities_current_amount_nonnegative check (current_amount >= 0),
    constraint chk_liabilities_installment_amount_nonnegative check (installment_amount is null or installment_amount >= 0),
    constraint chk_liabilities_credit_card_limit_nonnegative check (credit_card_limit is null or credit_card_limit >= 0),
    constraint chk_liabilities_credit_card_minimum_payment_nonnegative check (credit_card_minimum_payment is null or credit_card_minimum_payment >= 0)
);

create index idx_liabilities_owner_id
    on liabilities (owner_id);

create index idx_liabilities_bank_id
    on liabilities (bank_id);

create index idx_liabilities_owner_status
    on liabilities (owner_id, status);

create table liability_repayments (
    id uuid primary key,
    owner_id uuid not null references app_users (id),
    liability_id uuid not null references liabilities (id) on delete cascade,
    repayment_date date not null,
    current_amount numeric(19, 4) not null,
    amount numeric(19, 4) not null,
    note varchar(500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint chk_liability_repayments_current_amount_nonnegative check (current_amount >= 0),
    constraint chk_liability_repayments_amount_nonnegative check (amount >= 0)
);

create index idx_liability_repayments_owner_id
    on liability_repayments (owner_id);

create index idx_liability_repayments_liability_date
    on liability_repayments (liability_id, repayment_date desc);
