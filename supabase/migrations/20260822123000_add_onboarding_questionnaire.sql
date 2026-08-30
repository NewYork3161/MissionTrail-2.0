-- ============================================================
-- MISSION TRAILS ONBOARDING QUESTIONNAIRE
-- ============================================================

alter table public.user_onboarding
add column if not exists questionnaire_answers jsonb
not null default '{}'::jsonb;

alter table public.user_onboarding
add column if not exists questionnaire_complete boolean
not null default false;

alter table public.user_onboarding
add column if not exists questionnaire_completed_at timestamptz;


comment on column public.user_onboarding.questionnaire_answers is
'Private Mission Trails onboarding adventure-profile answers.';

comment on column public.user_onboarding.questionnaire_complete is
'True when the user completed the onboarding adventure questionnaire.';


-- ============================================================
-- COPY QUESTIONNAIRE FROM SIGNUP METADATA
-- ============================================================

create or replace function public.handle_new_user_questionnaire()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_answers text :=
    new.raw_user_meta_data ->> 'questionnaire_answers';

  parsed_answers jsonb :=
    '{}'::jsonb;

  answers_complete boolean :=
    false;
begin

  if raw_answers is not null
     and btrim(raw_answers) <> '' then

    begin
      parsed_answers :=
        raw_answers::jsonb;

    exception
      when others then
        parsed_answers :=
          '{}'::jsonb;
    end;

  end if;


  answers_complete :=
    jsonb_typeof(parsed_answers) = 'object'
    and parsed_answers <> '{}'::jsonb;


  insert into public.user_onboarding (
    user_id,
    questionnaire_answers,
    questionnaire_complete,
    questionnaire_completed_at,
    updated_at
  )
  values (
    new.id,
    parsed_answers,
    answers_complete,

    case
      when answers_complete
      then now()
      else null
    end,

    now()
  )

  on conflict (user_id)
  do update set

    questionnaire_answers =
      excluded.questionnaire_answers,

    questionnaire_complete =
      excluded.questionnaire_complete,

    questionnaire_completed_at =
      excluded.questionnaire_completed_at,

    updated_at =
      now();


  return new;
end;
$$;


revoke execute
on function public.handle_new_user_questionnaire()
from public, anon, authenticated;


drop trigger if exists
zz_on_auth_user_created_questionnaire
on auth.users;


create trigger
zz_on_auth_user_created_questionnaire
after insert on auth.users
for each row
execute function public.handle_new_user_questionnaire();
