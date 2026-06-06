with normalized_emails as (
    select
        id,
        lower(btrim(email)) as normalized_email,
        split_part(lower(btrim(email)), '@', 1) as local_part,
        split_part(lower(btrim(email)), '@', 2) as domain_part,
        row_number() over (
            partition by lower(btrim(email))
            order by created_at, id
        ) as duplicate_rank
    from app_users
)
update app_users user_row
set email = left(
    normalized_emails.local_part,
    greatest(
        1,
        180
        - length('@' || normalized_emails.domain_part)
        - length('+dup' || normalized_emails.duplicate_rank::text)
    )
) || '+dup' || normalized_emails.duplicate_rank::text || '@' || normalized_emails.domain_part
from normalized_emails
where user_row.id = normalized_emails.id
  and normalized_emails.duplicate_rank > 1
  and normalized_emails.domain_part <> '';

create unique index uq_app_users_email_normalized
    on app_users ((lower(btrim(email))));
