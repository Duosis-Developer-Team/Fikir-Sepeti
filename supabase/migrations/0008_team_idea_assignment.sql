-- S6: team ↔ idea assignment + team angle declaration
do $$ begin
  alter table teams add column idea_id uuid references ideas(id) on delete set null;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table teams add column angle text;
exception when duplicate_column then null; end $$;

create index if not exists teams_idea_id_idx on teams (idea_id);
