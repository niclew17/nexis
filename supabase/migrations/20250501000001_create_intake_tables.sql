create table if not exists intake_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  status       text not null default 'in_progress'
                 check (status in ('in_progress', 'completed', 'abandoned')),
  started_at   timestamptz default now(),
  completed_at timestamptz
);

create table if not exists intake_answers (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid references intake_sessions(id) on delete cascade,
  question_index   integer not null check (question_index between 0 and 3),
  question_text    text not null,
  raw_transcript   text,
  extracted_answer text,
  structured_data  jsonb,
  is_answered      boolean default false,
  answered_at      timestamptz,
  unique (session_id, question_index)
);

alter table intake_sessions enable row level security;
alter table intake_answers enable row level security;

create policy "Users manage own sessions"
  on intake_sessions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own answers"
  on intake_answers
  for all
  to authenticated
  using (
    session_id in (
      select id from intake_sessions where user_id = auth.uid()
    )
  )
  with check (
    session_id in (
      select id from intake_sessions where user_id = auth.uid()
    )
  );

create index if not exists intake_sessions_user_id_idx on intake_sessions (user_id);
create index if not exists intake_answers_session_id_idx on intake_answers (session_id);
