-- Pixel Arena: схема базы. Выполнить один раз в Supabase → SQL Editor → Run.
-- Доступ к таблицам только с сервера (secret key). RLS включён без политик,
-- поэтому публичный ключ не может ни читать, ни писать.

create table if not exists players (
  tg_id      bigint primary key,
  nick       text not null default 'PLAYER',
  avatar     text,
  best       int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists challenges (
  id           text primary key,
  game         text not null default 'joe',
  seed         bigint not null,
  level        int  not null,
  kills        int  not null,
  creator_id   bigint not null references players(tg_id) on delete cascade,
  creator_nick text not null,
  created_at   timestamptz not null default now()
);
create index if not exists challenges_creator_idx on challenges (creator_id);

create table if not exists challenge_results (
  challenge_id text   not null references challenges(id) on delete cascade,
  player_id    bigint not null references players(tg_id) on delete cascade,
  nick         text   not null,
  kills        int    not null,
  created_at   timestamptz not null default now(),
  primary key (challenge_id, player_id)
);

create table if not exists ads (
  id         bigint generated always as identity primary key,
  image_url  text not null,
  image_path text not null,
  link       text,
  title      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table players           enable row level security;
alter table challenges        enable row level security;
alter table challenge_results enable row level security;
alter table ads               enable row level security;

-- публичная папка для картинок баннеров (загружает только сервер)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ads', 'ads', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
