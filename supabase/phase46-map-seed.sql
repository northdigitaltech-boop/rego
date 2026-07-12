-- ============================================================
-- REGO — Phase 46: Rego Map seed (from the GB Tourist Guide Map)
-- Digitises the printed Gilgit-Baltistan tourist guide into real, geolocated
-- pins + a city-to-city distance chart. Idempotent (guarded by name), so it's
-- safe to run more than once. Requires phase45.
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

/* ---------------- Tourist places / pins ---------------- */
insert into public.map_places
  (name, category, district, latitude, longitude, description, status, is_verified, published, source)
select v.name, v.category, v.district, v.lat, v.lng, v.descr, 'open', true, true, 'GB Tourist Guide Map'
from (values
  -- Lakes
  ('Attabad Lake','lakes','Hunza',36.3436,74.8642,'Turquoise lake on the KKH; boating and jet-ski.'),
  ('Upper Kachura Lake','lakes','Skardu',35.4500,75.5200,'Deep alpine lake near Shangrila.'),
  ('Lower Kachura (Shangrila) Lake','lakes','Skardu',35.4419,75.5150,'Famous "Heaven on Earth" resort lake.'),
  ('Satpara (Sadpara) Lake','lakes','Skardu',35.2500,75.6200,'Reservoir lake above Skardu town.'),
  ('Sheosar Lake','lakes','Skardu',34.9000,75.0300,'High-altitude lake in Deosai National Park.'),
  ('Rush Lake','lakes','Nagar',36.1300,74.9000,'One of the highest alpine lakes; a classic trek.'),
  ('Rama Lake','lakes','Astore',35.3600,74.8200,'Alpine lake below Nanga Parbat near Rama Meadows.'),
  ('Borith Lake','lakes','Hunza',36.4300,74.8700,'Birdwatching lake near Passu & Ghulkin glaciers.'),
  ('Naltar Lakes','lakes','Gilgit',36.1300,74.2000,'Cluster of colourful lakes in Naltar Valley.'),
  ('Phander Lake','lakes','Ghizer',36.1500,73.3000,'Serene blue lake in Phander Valley.'),
  ('Khalti Lake','lakes','Ghizer',36.1900,72.9300,'Winter-freezing lake in Gupis-Yasin.'),
  -- Viewpoints / passes
  ('Khunjerab Pass','viewpoints','Hunza',36.8486,75.4181,'Pakistan–China border pass (~4,693 m); highest paved border crossing.'),
  ('Babusar Top','viewpoints','Diamer',35.1200,74.0500,'Scenic pass (~4,173 m) linking KP with GB.'),
  ('Shandur Pass','viewpoints','Ghizer',36.0800,72.5500,'"Roof of the World"; host of the Shandur Polo Festival.'),
  ('Rakaposhi View Point','viewpoints','Nagar',36.1600,74.5000,'Roadside viewpoint of Rakaposhi (7,788 m) at Ghulmet.'),
  ('Eagle''s Nest (Duikar)','viewpoints','Hunza',36.3400,74.7100,'Sunrise/sunset viewpoint above Karimabad.'),
  ('Nanga Parbat Viewpoint (Raikot)','viewpoints','Diamer',35.5500,74.6000,'KKH viewpoint of Nanga Parbat (8,126 m).'),
  ('Passu Cones Viewpoint','viewpoints','Hunza',36.4500,74.8700,'Iconic cathedral-like peaks on the KKH.'),
  ('Three Rivers Junction (Jaglot)','viewpoints','Gilgit',35.7300,74.6300,'Meeting point of the Karakoram, Himalaya and Hindukush.'),
  -- Forts / heritage
  ('Baltit Fort','forts','Hunza',36.3172,74.6694,'700-year-old fort above Karimabad.'),
  ('Altit Fort','forts','Hunza',36.3400,74.6800,'Oldest fort in Hunza, beside the Ultar glacier.'),
  ('Shigar Fort','forts','Shigar',35.4247,75.7333,'Restored 17th-century fort-palace (now a heritage hotel).'),
  ('Khaplu Palace','forts','Ghanche',35.1600,76.3200,'Grand 19th-century royal palace in Khaplu.'),
  ('Kharpocho Fort','forts','Skardu',35.3000,75.6300,'Hilltop fort overlooking Skardu and the Indus.'),
  -- National parks / plains
  ('Deosai National Park','parks','Skardu',34.9800,75.4000,'"Land of Giants" — second-highest plateau on earth.'),
  ('Khunjerab National Park','parks','Hunza',36.5000,75.4000,'Home to snow leopard, ibex and Marco Polo sheep.'),
  ('Central Karakoram National Park','parks','Skardu',35.9000,76.0000,'Protects K2 and the great Karakoram glaciers.'),
  -- Meadows / valleys / spots
  ('Fairy Meadows','tourist-spots','Diamer',35.3900,74.5800,'Lush meadow with a front-row view of Nanga Parbat.'),
  ('Rama Meadows','tourist-spots','Astore',35.3667,74.8200,'Alpine meadow and forest near Astore.'),
  ('Naltar Valley','tourist-spots','Gilgit',36.1600,74.1800,'Pine forests, lakes and a ski resort.'),
  ('Yasin Valley','tourist-spots','Ghizer',36.4000,73.3000,'Green valley famed for polo and culture.'),
  ('Chapursan Valley','tourist-spots','Hunza',36.7000,74.5000,'Remote valley near the Afghan border.'),
  ('Katpana Cold Desert','tourist-spots','Skardu',35.3200,75.5500,'High-altitude cold desert with sand dunes.'),
  ('Manthoka Waterfall','tourist-spots','Kharmang',35.1300,75.9500,'Popular roadside waterfall in Kharmang.'),
  ('Hussaini Suspension Bridge','tourist-spots','Hunza',36.4100,74.8700,'One of the world''s most thrilling rope bridges.'),
  -- Glaciers (as tourist spots)
  ('Passu Glacier','tourist-spots','Hunza',36.4400,74.8800,'Accessible glacier tongue near Passu village.'),
  ('Batura Glacier','tourist-spots','Hunza',36.5100,74.7500,'One of the longest glaciers outside the poles.'),
  -- Trekking routes / base camps
  ('K2 Base Camp / Concordia','trekking','Skardu',35.7400,76.5100,'Legendary trek to the base of K2 (8,611 m).'),
  ('Rakaposhi Base Camp','trekking','Nagar',36.1300,74.5300,'Popular moderate trek from Minapin/Ghulmet.'),
  ('Nanga Parbat Base Camp','trekking','Diamer',35.3200,74.5700,'Trek from Fairy Meadows to the Raikot base camp.'),
  ('Biafo–Hispar Snow Lake Trek','trekking','Skardu',35.9000,75.5000,'Epic glacier traverse joining Askole and Hispar.'),
  -- Camping
  ('Deosai Camping (Bara Pani)','camping','Skardu',35.0000,75.3000,'Riverside camping ground on the Deosai plains.'),
  -- Airports
  ('Gilgit Airport','airports','Gilgit',35.9188,74.3336,'Domestic airport (scenic PIA flights from Islamabad).'),
  ('Skardu International Airport','airports','Skardu',35.3350,75.5360,'Gateway airport for Skardu and Baltistan.')
) as v(name, category, district, lat, lng, descr)
where not exists (select 1 from public.map_places p where p.name = v.name);


/* ---------------- Distance chart (approximate road distances) ---------------- */
insert into public.distance_chart
  (from_location, to_location, distance_km, estimated_time, road_type, difficulty, notes)
select v.f, v.t, v.km, v.et, v.rt, v.df, v.nt
from (values
  ('Islamabad','Gilgit',500,'12–15 h','highway','moderate','Via the Karakoram Highway (KKH).'),
  ('Islamabad','Chilas',320,'9–10 h','highway','moderate','Via Naran–Babusar (summer) or KKH.'),
  ('Gilgit','Hunza (Karimabad)',100,'2.5–3 h','highway','easy','Smooth KKH stretch.'),
  ('Gilgit','Skardu',210,'6–7 h','highway','moderate','Scenic Indus-side road.'),
  ('Gilgit','Chilas',130,'3.5–4 h','highway','moderate','KKH southbound.'),
  ('Gilgit','Naltar',40,'1.5 h','jeep-track','moderate','Jeep track from Nomal.'),
  ('Gilgit','Phander',175,'5–6 h','metalled','moderate','Via Gupis, Ghizer valley.'),
  ('Gilgit','Khunjerab Pass',270,'7–8 h','highway','moderate','Border pass, seasonal.'),
  ('Hunza (Karimabad)','Khunjerab Pass',165,'4–5 h','highway','moderate','Via Sost; carry ID.'),
  ('Hunza (Karimabad)','Attabad Lake',20,'40 min','highway','easy','On the KKH.'),
  ('Skardu','Deosai (Sheosar)',80,'3–4 h','jeep-track','hard','4x4; open ~late June–Sept.'),
  ('Skardu','Shigar',32,'1 h','metalled','easy','Gateway to Shigar valley.'),
  ('Skardu','Khaplu',103,'2.5–3 h','metalled','moderate','Along the Shyok river.'),
  ('Skardu','Satpara Lake',8,'20 min','metalled','easy','Just above Skardu town.'),
  ('Chilas','Babusar Top',75,'2.5–3 h','metalled','moderate','Seasonal; closed in winter.'),
  ('Chilas','Fairy Meadows (Raikot)',80,'2.5 h + trek','jeep-track','hard','Jeep to Tato, then trek/hike.'),
  ('Astore','Rama Lake',24,'1–1.5 h','jeep-track','moderate','Via Rama Meadows.'),
  ('Gilgit','Rakaposhi View Point',60,'1.5 h','highway','easy','At Ghulmet on the KKH.')
) as v(f, t, km, et, rt, df, nt)
where not exists (
  select 1 from public.distance_chart d where d.from_location = v.f and d.to_location = v.t
);
