/* ============================================================
 * phase120 — tidy names already saved
 *
 * "GILGIT TOURS" and "hunza rides" were typed before the forms
 * started tidying names. This applies the same rule to what is
 * already stored.
 *
 * ---------------------------------------------------------------
 * THIS ONE HAS A REAL ROLLBACK
 *
 * Every original is copied into public.name_case_backup BEFORE
 * anything is changed. If a business name comes out wrong, it can
 * be put back exactly — see section 4. phase101 and phase119 had
 * no rollback and said so; this one does, because rewriting the
 * name a business trades under is not something to do on trust.
 *
 * ---------------------------------------------------------------
 * THE RULE, AND WHY IT DOES LESS THAN YOU MIGHT EXPECT
 *
 * Mirrors src/lib/text-case.ts exactly:
 *
 *   1. Mixed-case text is LEFT ALONE. "K2 Trekking", "McDonald",
 *      "iTravel", "DHA Phase 6" — somebody chose that, and
 *      second-guessing it corrupts brand names.
 *   2. Only all-UPPER or all-lower text is touched.
 *   3. Tokens of 3 characters or fewer are left as they are, so
 *      PIA, K2, NLI, DHA survive even inside a shouted name.
 *   4. Mc/Mac, apostrophes and hyphens are handled inside a word.
 *   5. of / the / bin / bin / al stay lowercase unless first.
 *
 * KNOWN RISK, STATED: this is a SECOND implementation of a rule
 * that also lives in TypeScript. Two implementations drift. If
 * the rule ever changes, change both — or better, run the tidy
 * from a Node script that imports the real one.
 *
 * ROLLBACK: section 4.
 * ============================================================ */


/* ============================================================
 * 1. THE FUNCTION
 * ============================================================ */
create or replace function public.rego_title_case(input text)
returns text
language plpgsql
immutable
as $fn$
declare
  s        text;
  letters  text;
  n_upper  int;
  n_lower  int;
  word     text;
  part     text;
  out_words text[] := '{}';
  out_parts text[];
  i        int := 0;
  minor    text[] := array[
    'a','an','and','as','at','by','de','del','der','di','du','for','in',
    'la','le','of','on','or','the','to','van','von','bin','binte','ud','ul','al'
  ];
begin
  if input is null then return null; end if;

  s := btrim(regexp_replace(input, '\s+', ' ', 'g'));
  if s = '' then return ''; end if;

  /* Rule 1: mixed case means a deliberate choice — leave it. */
  letters := regexp_replace(s, '[^A-Za-z]', '', 'g');
  if letters = '' then return s; end if;

  n_upper := length(regexp_replace(letters, '[^A-Z]', '', 'g'));
  n_lower := length(letters) - n_upper;
  if n_upper > 0 and n_lower > 0 then
    return s;
  end if;

  foreach word in array string_to_array(s, ' ') loop
    i := i + 1;

    /* Rule 3: short tokens are acronyms or codes. Leave them. */
    if length(regexp_replace(word, '[^A-Za-z0-9]', '', 'g')) <= 3 then
      out_words := out_words || word;
      continue;
    end if;

    /* Rule 5: minor words, except the first. */
    if i > 1 and lower(word) = any (minor) then
      out_words := out_words || lower(word);
      continue;
    end if;

    /* Rule 4: capitalise across hyphens and apostrophes. */
    out_parts := '{}';
    foreach part in array regexp_split_to_array(lower(word), '(?=[-''])|(?<=[-''])') loop
      if part in ('-', '''') or part = '' then
        out_parts := out_parts || part;
      else
        out_parts := out_parts || (upper(left(part, 1)) || substr(part, 2));
      end if;
    end loop;
    word := array_to_string(out_parts, '');

    /* Mc / Mac take a second capital. */
    if word ~ '^Ma?c[a-z]{3,}$' then
      word := regexp_replace(word, '^(Ma?c)([a-z])', '\1' || upper('\2'));
      word := regexp_replace(
        word, '^(Ma?c)(.)', '\1' || upper(substring(word from '^Ma?c(.)'))
      );
    end if;

    out_words := out_words || word;
  end loop;

  return array_to_string(out_words, ' ');
end $fn$;


/* ============================================================
 * 2. BACKUP TABLE — written before anything changes
 * ============================================================ */
create table if not exists public.name_case_backup (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null,
  column_name   text not null,
  row_id        uuid not null,
  original      text not null,
  tidied        text not null,
  restored_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists name_case_backup_row_idx
  on public.name_case_backup (table_name, row_id);

alter table public.name_case_backup enable row level security;

drop policy if exists name_case_backup_admin on public.name_case_backup;
create policy name_case_backup_admin on public.name_case_backup
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


/* ============================================================
 * 3. PREVIEW — read-only. RUN THIS ON ITS OWN FIRST.
 *
 * Every name that would change, old beside new. Read it. If any
 * row looks wrong, stop and tell me rather than running section 4.
 * ============================================================ */
do $$
declare
  r record;
  t text;
  c text;
  pairs text[][] := array[
    ['profiles','full_name'],
    ['hotels','title'],
    ['homestays','title'],
    ['hostels','title'],
    ['tour_companies','name'],
    ['tour_guides','name'],
    ['transport_providers','name'],
    ['media_providers','company_name'],
    ['restaurants','name'],
    ['coworking_spaces','name'],
    ['roadside_providers','business_name'],
    ['expedition_companies','name'],
    ['expedition_professionals','full_name'],
    ['activities','business_name']
  ];
  n bigint;
  total bigint := 0;
begin
  for i in 1 .. array_length(pairs, 1) loop
    t := pairs[i][1];
    c := pairs[i][2];

    if to_regclass('public.' || t) is null then continue; end if;
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = c
    ) then continue; end if;

    execute format(
      'select count(*) from public.%I where %I is not null
         and %I <> public.rego_title_case(%I)', t, c, c, c
    ) into n;

    if n > 0 then
      raise notice '% . % — % name(s) would change', t, c, n;
      total := total + n;
    end if;
  end loop;

  raise notice '--- % name(s) would change in total ---', total;
  raise notice 'Run the SELECT below to see them before changing anything.';
end $$;

/* The actual rows. Add more tables here if the notice above named them. */
select 'tour_companies' as tbl, name as original,
       public.rego_title_case(name) as would_become
  from public.tour_companies
 where name is not null and name <> public.rego_title_case(name)
union all
select 'transport_providers', name, public.rego_title_case(name)
  from public.transport_providers
 where name is not null and name <> public.rego_title_case(name)
union all
select 'profiles', full_name, public.rego_title_case(full_name)
  from public.profiles
 where full_name is not null and full_name <> public.rego_title_case(full_name)
 order by 1, 2;


/* ============================================================
 * 4. APPLY — only after reading the preview.
 *
 * Uncomment the block and run it. It backs up every original
 * first, then updates.
 * ============================================================ */
/*
do $$
declare
  t text; c text; i int;
  pairs text[][] := array[
    ['profiles','full_name'],
    ['hotels','title'],
    ['homestays','title'],
    ['hostels','title'],
    ['tour_companies','name'],
    ['tour_guides','name'],
    ['transport_providers','name'],
    ['media_providers','company_name'],
    ['restaurants','name'],
    ['coworking_spaces','name'],
    ['roadside_providers','business_name'],
    ['expedition_companies','name'],
    ['expedition_professionals','full_name'],
    ['activities','business_name']
  ];
begin
  for i in 1 .. array_length(pairs, 1) loop
    t := pairs[i][1];
    c := pairs[i][2];

    if to_regclass('public.' || t) is null then continue; end if;
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = c
    ) then continue; end if;

    execute format(
      'insert into public.name_case_backup (table_name, column_name, row_id, original, tidied)
       select %L, %L, id, %I, public.rego_title_case(%I)
         from public.%I
        where %I is not null and %I <> public.rego_title_case(%I)',
      t, c, c, c, t, c, c, c
    );

    execute format(
      'update public.%I set %I = public.rego_title_case(%I)
        where %I is not null and %I <> public.rego_title_case(%I)',
      t, c, c, c, c, c
    );

    raise notice 'tidied %.%', t, c;
  end loop;
end $$;
*/


/* ============================================================
 * 5. ROLLBACK — puts every original back.
 *
 * Uncomment and run if anything came out wrong.
 * ============================================================ */
/*
do $$
declare r record;
begin
  for r in
    select * from public.name_case_backup where restored_at is null
  loop
    execute format('update public.%I set %I = $1 where id = $2',
                   r.table_name, r.column_name)
      using r.original, r.row_id;
    update public.name_case_backup set restored_at = now() where id = r.id;
  end loop;
end $$;
*/
