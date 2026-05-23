alter table account_snapshots
    add column snapshot_type varchar(20);

alter table account_snapshots
    add constraint chk_account_snapshots_snapshot_type
        check (snapshot_type in ('FINAL', 'PARTIAL'));
