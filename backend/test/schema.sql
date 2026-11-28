-- Copy of the real Supabase tables (public schema), used by test/repositories.test.js.
-- When a table changes in Supabase, change it here too. Supabase's own extras (tablespace) are left out.
-- auth.users is Supabase's login table; the test creates a small stand-in for it.

create table users (
  user_id uuid not null,
  name text not null,
  email text not null,
  role text not null default 'worker'::text,
  created_at timestamp with time zone not null default now(),
  constraint users_pkey primary key (user_id),
  constraint users_email_key unique (email),
  constraint users_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint users_role_check check (role = any (array['admin'::text, 'worker'::text, 'maintenance_worker'::text]))
);

create table desks (
  desk_id uuid not null default gen_random_uuid(),
  user_id uuid null,
  manufacturer text not null,
  last_height integer null,
  mac_address text null,
  constraint desks_pkey primary key (desk_id),
  constraint desks_user_id_key unique (user_id),
  constraint desks_mac_address_key unique (mac_address),
  constraint desks_mac_address_check check (mac_address ~ '^([0-9a-f]{2}:){5}[0-9a-f]{2}$'),
  constraint desks_user_id_fkey foreign key (user_id) references users (user_id) on delete set null
);

create table errors (
  error_id uuid not null default gen_random_uuid(),
  desk_id uuid not null,
  description text not null,
  created_at timestamp with time zone not null default now(),
  constraint errors_pkey primary key (error_id),
  constraint errors_desk_id_fkey foreign key (desk_id) references desks (desk_id) on delete cascade
);

create table health (
  health_id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  "position" text not null,
  recorded_at timestamp with time zone not null default now(),
  constraint health_pkey primary key (health_id),
  constraint health_user_id_fkey foreign key (user_id) references users (user_id) on delete cascade,
  constraint health_position_check check ("position" = any (array['sitting'::text, 'standing'::text]))
);

create table presets (
  preset_id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  position_name text not null,
  value integer not null,
  constraint presets_pkey primary key (preset_id),
  constraint presets_user_id_fkey foreign key (user_id) references users (user_id) on delete cascade,
  constraint presets_value_check check (value >= 50 and value <= 160)
);

create table routines (
  routine_id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  routine_name text not null,
  sit_minutes integer not null,
  stand_minutes integer not null,
  sitting_preset_id uuid null,
  standing_preset_id uuid null,
  is_active boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint routines_pkey primary key (routine_id),
  constraint routines_user_id_routine_name_key unique (user_id, routine_name),
  constraint routines_user_id_fkey foreign key (user_id) references users (user_id) on delete cascade,
  constraint routines_sitting_preset_id_fkey foreign key (sitting_preset_id) references presets (preset_id) on delete set null,
  constraint routines_standing_preset_id_fkey foreign key (standing_preset_id) references presets (preset_id) on delete set null,
  constraint routines_stand_minutes_check check (stand_minutes > 0),
  constraint routines_sit_minutes_check check (sit_minutes > 0)
);

create unique index routines_one_active_per_user on routines (user_id) where is_active;
