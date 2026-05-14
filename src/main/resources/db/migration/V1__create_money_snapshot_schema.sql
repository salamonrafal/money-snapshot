create table currencies (
    code char(3) primary key,
    name varchar(80) not null,
    created_at timestamptz not null default now()
);

create table accounts (
    id uuid primary key,
    name varchar(120) not null,
    account_type varchar(40) not null,
    currency_code char(3) not null references currencies (code),
    description varchar(500),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table account_snapshots (
    id uuid primary key,
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

insert into currencies (code, name)
values
    ('PLN', 'Polish Zloty'),
    ('EUR', 'Euro'),
    ('USD', 'US Dollar');
