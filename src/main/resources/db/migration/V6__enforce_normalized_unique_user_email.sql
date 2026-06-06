with normalized_emails as (
    select
        id,
        lower(btrim(email)) as normalized_email,
        row_number() over (
            partition by lower(btrim(email))
            order by created_at, id
        ) as duplicate_rank
    from app_users
)
update app_users user_row
set email = left(
    normalized_emails.normalized_email,
    180 - length('+dup' || normalized_emails.duplicate_rank::text)
) || '+dup' || normalized_emails.duplicate_rank::text
from normalized_emails
where user_row.id = normalized_emails.id
  and normalized_emails.duplicate_rank > 1;

create unique index uq_app_users_email_normalized
    on app_users ((lower(btrim(email))));
