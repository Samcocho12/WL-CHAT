-- LUX Chat - Esquema para Supabase
-- Pégalo en Supabase -> SQL Editor -> New query -> Run

create table if not exists public.usuarios (
  id            bigint generated always as identity primary key,
  username      text not null unique,
  password_hash text not null,
  color         text not null default '#7c5cff',
  creado_en     timestamptz not null default now(),
  ultima_conexion timestamptz
);

create table if not exists public.mensajes (
  id         bigint generated always as identity primary key,
  usuario_id bigint not null references public.usuarios(id) on delete cascade,
  username   text not null,
  contenido  text not null check (char_length(contenido) between 1 and 1000),
  creado_en  timestamptz not null default now()
);

create index if not exists idx_mensajes_creado_en on public.mensajes (creado_en desc);

-- Seguridad: activamos RLS sin políticas públicas.
-- Solo el servidor (con la service role key) puede leer/escribir.
alter table public.usuarios enable row level security;
alter table public.mensajes enable row level security;
