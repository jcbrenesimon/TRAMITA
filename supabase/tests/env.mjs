// Entorno de pruebas que imita Supabase sobre PGlite (Postgres 17 en WASM).
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import fs from 'node:fs';

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Raíz del repositorio (supabase/tests/ → ../../)
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const SUPABASE_STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions;
create extension pgcrypto schema extensions; create extension "uuid-ossp" schema extensions;
create schema auth; create schema storage;
grant usage on schema auth, storage, extensions to anon, authenticated, service_role;

create table auth.users (
  instance_id uuid, id uuid primary key, aud varchar(255), role varchar(255), email varchar(255),
  encrypted_password varchar(255), email_confirmed_at timestamptz, invited_at timestamptz,
  confirmation_token varchar(255), confirmation_sent_at timestamptz, recovery_token varchar(255),
  recovery_sent_at timestamptz, email_change_token_new varchar(255), email_change varchar(255),
  email_change_sent_at timestamptz, last_sign_in_at timestamptz, raw_app_meta_data jsonb,
  raw_user_meta_data jsonb, is_super_admin boolean, created_at timestamptz, updated_at timestamptz,
  phone text, phone_change text default '', phone_change_token varchar(255) default '',
  email_change_token_current varchar(255) default '', reauthentication_token varchar(255) default '',
  banned_until timestamptz, deleted_at timestamptz, is_sso_user boolean default false, is_anonymous boolean default false
);
create table auth.identities (
  provider_id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null, provider text not null, last_sign_in_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  email text generated always as (lower(identity_data->>'email')) stored,
  id uuid primary key default gen_random_uuid(), unique (provider_id, provider)
);
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  friendly_name text, factor_type text, status text, created_at timestamptz default now(), updated_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.role() returns text language sql stable as
  $$ select coalesce(auth.jwt()->>'role', 'anon') $$;

create table storage.buckets (id text primary key, name text, owner uuid, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts,1)-1]; end $$;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
`;

const SUPABASE_GRANTS = `
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export async function createDb() {
  const db = new PGlite({ extensions: { pgcrypto, uuid_ossp, unaccent } });
  await db.exec(SUPABASE_STUBS);
  await db.exec(fs.readFileSync(`${REPO}/supabase/baseline/20261011_00_esquema_produccion.sql`, 'utf8'));
  await db.exec(SUPABASE_GRANTS);
  return db;
}

export async function runFile(db, rel) {
  await db.exec(fs.readFileSync(`${REPO}/${rel}`, 'utf8'));
}

// Crea un usuario de auth (el trigger crea su perfil) y devuelve {uid, profileId}
export async function createAuthUser(db, email, role = 'cliente', meta = {}) {
  const uid = (await db.query('select gen_random_uuid() as id')).rows[0].id;
  await db.query(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, 'x', now(), now(), now(),
      '{"provider":"email"}', $3, '', '', '', '')`, [uid, email, JSON.stringify(meta)]);
  if (role !== 'cliente') await db.query(`update public.users_profile set role = $1 where user_id = $2`, [role, uid]);
  const p = (await db.query(`select id from public.users_profile where user_id = $1`, [uid])).rows[0];
  return { uid, profileId: p?.id };
}

// Ejecuta fn como un usuario (o anon si uid es null), con aal opcional
export async function as(db, uid, fn, { aal = 'aal1' } = {}) {
  await db.exec(`reset role`);
  if (uid) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`,
      [uid, JSON.stringify({ sub: uid, role: 'authenticated', aal })]);
    await db.exec(`set role authenticated`);
  } else {
    await db.query(`select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '{"role":"anon"}', false)`);
    await db.exec(`set role anon`);
  }
  try { return await fn(); } finally { await db.exec(`reset role`); }
}

export async function rpc(db, name, args = {}) {
  const keys = Object.keys(args);
  const sql = `select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
  const vals = keys.map(k => (args[k] !== null && typeof args[k] === 'object') ? JSON.stringify(args[k]) : args[k]);
  try {
    const res = await db.query(sql, vals);
    return { data: res.rows[0].r, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

export async function q(db, sql, params = []) {
  try { return { rows: (await db.query(sql, params)).rows, error: null }; }
  catch (e) { return { rows: null, error: e.message }; }
}
