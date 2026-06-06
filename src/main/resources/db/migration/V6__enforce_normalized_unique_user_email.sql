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
set email = case
    when normalized_emails.duplicate_rank = 1 then normalized_emails.normalized_email
    when position('@' in normalized_emails.normalized_email) > 0 then
        split_part(normalized_emails.normalized_email, '@', 1)
        || '+dup'
        || normalized_emails.duplicate_rank::text
        || '@'
        || split_part(normalized_emails.normalized_email, '@', 2)
    else normalized_emails.normalized_email || '+dup' || normalized_emails.duplicate_rank::text
end
from normalized_emails
where user_row.id = normalized_emails.id
  and normalized_emails.duplicate_rank > 1;

create unique index uq_app_users_email_normalized
    on app_users ((lower(btrim(email))));
