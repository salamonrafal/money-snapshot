alter table accounts
    add column if not exists bank_account_number varchar(64),
    add column if not exists show_in_snapshots boolean not null default true;

update accounts
set show_in_snapshots = true
where show_in_snapshots is null;
