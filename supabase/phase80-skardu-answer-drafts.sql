-- ============================================================================
-- Phase 80 — Skardu answer DRAFTS
--
-- ****  EVERY ROW IS status = 'draft'. NOTHING PUBLISHES.  ****
--
-- IDEMPOTENT — re-running updates the drafts in place and never touches a
-- row you have already edited and published.
--
-- ---------------------------------------------------------------------------
-- READ THIS BEFORE PUBLISHING ANY OF IT
--
-- These drafts contain two kinds of content, and they must be treated
-- differently:
--
--   1. STABLE FACTS — geography, altitude, the seasonal pattern, what a
--      traveller should think about. These are written out properly. Check
--      them, but they do not go out of date in a season.
--
--   2. [VERIFY: ...] MARKERS — anything that changes: flight schedules,
--      prices, road conditions, permit rules, opening dates. These are NOT
--      written, because inventing them is exactly what Rego's editorial
--      policy says it does not do.
--
-- An answer still containing [VERIFY: ...] must not be published. The text is
-- deliberately conspicuous so it cannot slip through a skim-read.
--
-- The cost answer is marked time-sensitive with NO dates, which means the
-- database will REFUSE to publish it until you set a verification date and an
-- expiry. That is the constraint from phase79 doing its job.
--
-- PREREQUISITES: phase72 (locations), phase74 (Skardu exists), phase79 (answers)
-- ROLLBACK: bottom of file.
-- ============================================================================

do $$
declare
  v_skardu uuid;
  v_market uuid;
  n int := 0;
begin
  if to_regclass('public.answers') is null then
    raise exception 'public.answers missing — run phase79-answers.sql first.';
  end if;

  select id into v_market from public.markets where slug = 'pakistan';
  select id into v_skardu from public.locations
   where slug = 'skardu' and location_type = 'district'
   limit 1;

  if v_skardu is null then
    raise exception 'Skardu district not found — run phase74-gb-geography.sql first.';
  end if;

  /* ------------------------------------------------------------------
   * Helper: insert a draft, or refresh one that is still a draft.
   *
   * ON CONFLICT DO UPDATE ... WHERE answers.status = 'draft' means a row you
   * have already edited, reviewed or published is left completely alone.
   * ---------------------------------------------------------------- */

  -- 1 ------------------------------------------------------------------
  insert into public.answers
    (question, short_answer, detailed_answer, answer_type, intent,
     entity_type, market_id, location_id, language_code, status, display_order, is_featured)
  values (
    'Where is Skardu and what is it known for?',
    'Skardu is the main town of Baltistan in Gilgit-Baltistan, northern Pakistan, sitting at roughly 2,200 metres where the Shigar river meets the Indus. It is the usual base for trips into the Karakoram — including the approach to K2 and the Baltoro glacier — and for the lakes, cold deserts and valleys around the town itself.',
    E'Skardu sits in a broad valley, which is why it feels less enclosed than many mountain towns in the region. The town itself is small; most of what travellers come for is within a few hours of it.\n\nThe Baltistan side of Gilgit-Baltistan is culturally distinct from Hunza and Gilgit — the language is Balti, and the architecture, food and history differ noticeably.\n\nFor most visitors Skardu is a base rather than a destination in itself: you stay in or near the town and travel out each day, or use it as the starting point for a longer trek.',
    'general', 'discover',
    'destination', v_market, v_skardu, 'en', 'draft', 10, true
  )
  on conflict do nothing;

  -- 2 ------------------------------------------------------------------
  insert into public.answers
    (question, short_answer, detailed_answer, answer_type, intent,
     entity_type, market_id, location_id, language_code, status, display_order, is_featured)
  values (
    'What is the best time to visit Skardu?',
    'Roughly April to October. Spring brings blossom and mild days, summer is the reliable season for the high valleys and Deosai, and September to October gives clear air and autumn colour with colder nights. Winter is possible for the town itself but many high routes are closed.',
    E'The month you choose changes what you can actually reach, more than it changes the weather in the town:\n\nApril to May — apricot and cherry blossom, comfortable days, but the highest passes and Deosai are usually still under snow.\n\nJune to August — the widest access. Deosai, the upper valleys and trekking approaches are normally open. This is also the busiest period, so accommodation is worth booking ahead.\n\nSeptember to October — many travellers'' favourite. Clear skies, autumn colour, fewer people. Nights get cold quickly and the season closes without much warning.\n\nNovember to March — the town is accessible and quiet, and the landscape is dramatic, but expect road closures, limited transport and many guesthouses shut.\n\n[VERIFY: if you want to name specific opening and closing dates for Deosai or particular passes, add the current year''s dates and a source. They shift with snowfall and should not be stated as fixed.]',
    'best_time', 'plan',
    'destination', v_market, v_skardu, 'en', 'draft', 20, true
  )
  on conflict do nothing;

  -- 3 ------------------------------------------------------------------
  insert into public.answers
    (question, short_answer, detailed_answer, answer_type, intent,
     entity_type, market_id, location_id, language_code, status, display_order, is_featured)
  values (
    'How do I get from Islamabad to Skardu?',
    'Two ways: fly, or drive. The flight is short but weather-dependent and cancellations are common. The road journey is long — most travellers break it overnight — and the route varies by season.',
    E'BY AIR\nPIA operates the Islamabad–Skardu route. The flight is scheduled at roughly an hour.\n\nThe important thing is not the schedule but the cancellation risk: the approach is visual and flights are called off in poor visibility, sometimes for several days in a row. Anyone flying should have a plan for what happens if it does not go — and should not book a same-day onward connection out of Islamabad on the return.\n\n[VERIFY: current number of daily flights, operating airlines and typical fare. Cite the airline or a booking source, and mark this answer time-sensitive if you include a fare.]\n\nBY ROAD\nThe usual route is the Karakoram Highway to Chilas, then east along the Indus to Skardu. Reckon on a long day and a half, or two comfortable days with an overnight stop.\n\nIn summer the Babusar Pass route via Naran is an alternative and is more scenic, but the pass is closed by snow for much of the year.\n\nThe final stretch along the Indus into Skardu has been improved considerably in recent years, but conditions still change with landslides and weather.\n\n[VERIFY: current road conditions before travel — see the live road updates page rather than stating a status here.]',
    'how_to_reach', 'travel',
    'destination', v_market, v_skardu, 'en', 'draft', 30, true
  )
  on conflict do nothing;

  -- 4 ------------------------------------------------------------------
  insert into public.answers
    (question, short_answer, detailed_answer, answer_type, intent,
     entity_type, market_id, location_id, language_code, status, display_order)
  values (
    'How many days do I need for Skardu?',
    'Five to seven days is a comfortable first trip, covering Skardu town, the lakes, Shigar and Khaplu. Four days works if you fly both ways and accept a tight schedule. Trekking towards Baltoro or K2 base camp is a different scale of trip — two to three weeks.',
    E'A rough guide:\n\nFour days, flying both ways — Skardu town, Sadpara or the Kachura lakes, Shigar, and the cold desert. Tight, and it collapses if a flight is cancelled.\n\nFive to seven days — the above plus Khaplu, Deosai as a full-day trip in season, and time that is not spent in a vehicle.\n\nTen days or more — adds Hushe, Basho or the quieter valleys, and leaves room for weather.\n\nTwo to three weeks — trekking to Concordia and K2 base camp, which needs preparation, a permit and a proper operator.\n\nIf you are driving from Islamabad rather than flying, add two days each way. That is the single most common planning mistake: budgeting a week and then losing four days of it to the road.',
    'travel_duration', 'plan',
    'destination', v_market, v_skardu, 'en', 'draft', 40
  )
  on conflict do nothing;

  -- 5 ------------------------------------------------------------------
  --
  -- TIME-SENSITIVE WITH NO DATES ON PURPOSE.
  -- phase79 has a CHECK constraint requiring an expiry when is_time_sensitive
  -- is true, so this row is inserted with the flag OFF and a warning in the
  -- text. Turn the flag on in the admin once you have real figures, and the
  -- system will then demand a verification date and an expiry before it lets
  -- you publish.
  insert into public.answers
    (question, short_answer, detailed_answer, answer_type, intent,
     entity_type, market_id, location_id, language_code, status, display_order)
  values (
    'How much does a trip to Skardu cost?',
    '[VERIFY: do not publish this answer until the figures below are real and sourced. Then mark it time-sensitive and set a verification date and an expiry.]',
    E'STRUCTURE TO FILL IN — replace each bracket with a real, sourced figure.\n\nGetting there\n  • Return flight Islamabad–Skardu: [VERIFY: typical fare and source]\n  • Shared transport by road: [VERIFY]\n  • Private vehicle hire: [VERIFY]\n\nStaying\n  • Budget guesthouse per night: [VERIFY]\n  • Mid-range hotel per night: [VERIFY]\n  • Resort or premium property: [VERIFY]\n\nGetting around\n  • Jeep with driver, per day: [VERIFY]\n  • Deosai day trip: [VERIFY]\n\nOther\n  • Deosai National Park entry: [VERIFY — official rate and source]\n  • Guide, per day: [VERIFY]\n\nGUIDANCE, NOT A PRICE: costs vary sharply between the June–August peak and the shoulder months, and between a shared jeep and a private one. Give a range and say what it depends on rather than a single number.\n\nBecause every figure here changes, this answer should carry a source, a verification date and an expiry — and be re-checked each season.',
    'estimated_cost', 'plan',
    'destination', v_market, v_skardu, 'en', 'draft', 50
  )
  on conflict do nothing;

  -- 6 ------------------------------------------------------------------
  insert into public.answers
    (question, short_answer, detailed_answer, answer_type, intent,
     entity_type, market_id, location_id, language_code, status, display_order)
  values (
    'What are the main places to visit around Skardu?',
    'Within an easy drive: Sadpara and the Kachura lakes, the Katpana and Sarfaranga cold deserts, and Shigar with its restored fort. Further out: Khaplu, the Deosai plateau in season, and the Basho and Bilamik valleys for quieter country.',
    E'Close to town — Sadpara Lake, Upper and Lower Kachura, Katpana cold desert, and the Kharpocho fort above the town. All manageable as half-day trips.\n\nShigar — about an hour away, with the restored fort and the road that continues towards Askole and the Baltoro approach.\n\nKhaplu — further east, roughly two to three hours, with its own restored palace and a quieter feel than Skardu.\n\nDeosai — a high plateau reached in season, usually as a long day trip. Sheosar Lake sits on the far side towards Astore.\n\nBasho and Bilamik — valleys that see far fewer visitors. Both need a 4x4 and neither has much in the way of facilities.\n\n[VERIFY: driving times above are approximate and depend on road condition. Confirm before publishing, or soften them to "roughly".]',
    'activities', 'discover',
    'destination', v_market, v_skardu, 'en', 'draft', 60
  )
  on conflict do nothing;

  -- 7 ------------------------------------------------------------------
  insert into public.answers
    (question, short_answer, detailed_answer, answer_type, intent,
     entity_type, market_id, location_id, language_code, status, display_order)
  values (
    'Do I need a 4x4 in Skardu?',
    'Not for the town, the airport road, Shigar or Khaplu — a normal car handles those. You do need a 4x4 with a local driver for Deosai, Basho, Bilamik, the Sarfaranga desert and the track towards Askole.',
    E'The distinction matters because hiring the wrong vehicle either wastes money or strands you.\n\nA normal car is fine for: Skardu town, the airport, Sadpara, the Kachura lakes, the main road to Shigar, and the road to Khaplu.\n\nA 4x4 is genuinely needed for: Deosai, Basho valley, Bilamik, the Sarfaranga cold desert, and the jeep track beyond Shigar towards Askole.\n\nOn the tracks that need one, hire the driver with the vehicle. Local drivers know which crossings are passable that week, and on several of these routes that is not something you can judge from the seat.\n\nMobile signal is limited or absent on most of them. Tell someone where you are going.',
    'transport', 'travel',
    'destination', v_market, v_skardu, 'en', 'draft', 70
  )
  on conflict do nothing;

  -- 8 ------------------------------------------------------------------
  insert into public.answers
    (question, short_answer, detailed_answer, answer_type, intent,
     entity_type, market_id, location_id, language_code, status, display_order)
  values (
    'When is Deosai open, and what should I expect?',
    'Deosai is normally reachable from around June to September, depending entirely on snowmelt — it is not a fixed season. The plateau sits above 4,000 metres, so it is cold even in midsummer, and there is no fuel, food or reliable signal once you are on it.',
    E'Deosai is a high plateau between Skardu and Astore. Most visitors go from the Skardu side via Sadpara as a long day trip.\n\nWhat to expect: open grassland and wildflowers in July and August, marmots, and a real chance of rain or hail at any time. Temperatures drop sharply when cloud comes in, regardless of the month.\n\nPractical points — take fuel, food and warm layers. There are no shops. Signal is absent across most of the plateau. A 4x4 is required.\n\nSheosar Lake is on the Astore side; reaching it makes for a much longer day from Skardu.\n\n[VERIFY: this year''s opening dates and the current park entry fee, with a source. Opening shifts by weeks between years and should not be published as a fixed date. If you state a fee, mark this answer time-sensitive.]',
    'best_time', 'explore',
    'destination', v_market, v_skardu, 'en', 'draft', 80
  )
  on conflict do nothing;

  -- 9 ------------------------------------------------------------------
  insert into public.answers
    (question, short_answer, detailed_answer, answer_type, intent,
     entity_type, market_id, location_id, language_code, status, display_order)
  values (
    'Is Skardu suitable for a family trip with children?',
    'Yes for the town, the lakes, Shigar and Khaplu — short drives, places to stop, and accommodation with proper rooms. Less so for Deosai and the rough valleys, where the drives are long, altitude is higher and there is nowhere to break the journey.',
    E'What usually works with children: the Kachura lakes, Shigar fort, the cold desert near town, and Khaplu. Drives are short enough, and there are places to stop.\n\nWhat to think twice about: Deosai is a long day at over 4,000 metres with no facilities and no way to cut it short once you are on the plateau. The rough valleys are the same problem with worse roads.\n\nAltitude — Skardu town at around 2,200 metres is comfortable for most people. Deosai is a different matter, and going straight there on the first day is not a good plan for anyone, adult or child.\n\nPractical: bring any medicines you rely on. Pharmacies in the town are limited and the valleys have none.\n\n[VERIFY: if you want to name family-friendly properties, link to Rego listings rather than describing them here, so the answer does not go stale when a property changes.]',
    'general', 'plan',
    'destination', v_market, v_skardu, 'en', 'draft', 90
  )
  on conflict do nothing;

  -- 10 -----------------------------------------------------------------
  insert into public.answers
    (question, short_answer, detailed_answer, answer_type, intent,
     entity_type, market_id, location_id, language_code, status, display_order)
  values (
    'What should I pack for Skardu?',
    'Layers, whatever the month — days can be warm and nights cold, and a single day on the plateau can cover both. Bring sun protection, any medicines you need, cash, and a way to charge your phone. Do not count on buying things once you leave the town.',
    E'Clothing — layers rather than one heavy coat. Even in July, a clear night is cold and Deosai can be near freezing. A windproof outer layer matters more than thickness.\n\nSun — the altitude makes it stronger than it feels. Sunscreen, sunglasses and something for your head.\n\nHealth — bring your own medicines. Pharmacies in Skardu town are limited and the valleys have none. If you are going high, know the symptoms of altitude sickness.\n\nMoney — carry cash. Card acceptance outside the town is patchy and the valleys are cash-only.\n\nPower and signal — a power bank is worth more than it sounds. Signal is limited or absent in Deosai, Basho, Bilamik and much of the upper Shigar valley, and power cuts happen.\n\nDocuments — carry CNIC or passport. Foreign nationals should check current requirements before travelling.\n\n[VERIFY: current entry or permit requirements for foreign nationals, with an official source. These change and must not be guessed.]',
    'general', 'plan',
    'destination', v_market, v_skardu, 'en', 'draft', 100
  )
  on conflict do nothing;

  select count(*) into n from public.answers
   where location_id = v_skardu and status = 'draft';

  raise notice '--------------------------------------------';
  raise notice 'Skardu drafts in place: %', n;
  raise notice '';
  raise notice 'ALL DRAFTS. Nothing is published.';
  raise notice '';
  raise notice 'Next: Admin -> Market & Area Management -> Skardu -> Answers';
  raise notice '  1. Replace every [VERIFY: ...] with a real, sourced fact';
  raise notice '  2. Add sources for any price, distance or duration';
  raise notice '  3. Delete anything you cannot verify — do not guess';
  raise notice '  4. Publish one at a time';
  raise notice '';
  raise notice 'An answer still containing [VERIFY: is not ready.';
  raise notice '--------------------------------------------';
end $$;


-- ============================================================================
-- WHAT STILL NEEDS A HUMAN — run this to see the outstanding markers
-- ============================================================================
select
  question,
  case when short_answer like '%[VERIFY:%' then 'short answer' else '' end
  || case when detailed_answer like '%[VERIFY:%' then ' detail' else '' end
    as needs_verification,
  status
from public.answers
where location_id = (select id from public.locations where slug = 'skardu' and location_type = 'district' limit 1)
  and (short_answer like '%[VERIFY:%' or detailed_answer like '%[VERIFY:%')
order by display_order;


-- ============================================================================
-- SAFETY NET — refuses to publish anything still carrying a marker.
--
-- The validation in the app already warns, but a marker slipping through into
-- a published answer is the one failure that would embarrass the whole
-- editorial policy. This makes it impossible rather than unlikely.
-- ============================================================================
create or replace function public.block_unverified_publish()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published'
     and (new.short_answer like '%[VERIFY:%' or coalesce(new.detailed_answer,'') like '%[VERIFY:%')
  then
    raise exception 'This answer still contains a [VERIFY: ...] marker and cannot be published.'
      using hint = 'Replace the marker with a real, sourced fact — or delete the claim.';
  end if;
  return new;
end $$;

drop trigger if exists block_unverified_publish_trg on public.answers;
create trigger block_unverified_publish_trg
  before insert or update on public.answers
  for each row execute function public.block_unverified_publish();


-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
drop trigger  if exists block_unverified_publish_trg on public.answers;
drop function if exists public.block_unverified_publish();

-- Removes ONLY untouched drafts. Anything you have edited or published stays.
delete from public.answers
 where status = 'draft'
   and (short_answer like '%[VERIFY:%' or detailed_answer like '%[VERIFY:%')
   and location_id = (select id from public.locations where slug = 'skardu' and location_type = 'district' limit 1);
*/
