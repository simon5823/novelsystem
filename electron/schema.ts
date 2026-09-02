export const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS volumes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  part_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  volume_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  body TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS time_points (
  id TEXT PRIMARY KEY,
  sort_key REAL NOT NULL,
  label TEXT NOT NULL,
  era TEXT,
  year INTEGER,
  month INTEGER,
  day INTEGER,
  season TEXT,
  hour INTEGER,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  summary TEXT NOT NULL DEFAULT '',
  controlling_faction_id TEXT,
  map_x REAL,
  map_y REAL,
  effective_from_time_id TEXT,
  effective_to_time_id TEXT
);

CREATE TABLE IF NOT EXISTS factions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  hierarchy_notes TEXT NOT NULL DEFAULT '',
  parent_faction_id TEXT,
  effective_from_time_id TEXT,
  effective_to_time_id TEXT
);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  time_point_id TEXT,
  location_id TEXT,
  pov_character_id TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS scene_presence (
  scene_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  PRIMARY KEY (scene_id, character_id)
);

CREATE TABLE IF NOT EXISTS scene_threads (
  scene_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  beat_id TEXT,
  PRIMARY KEY (scene_id, thread_id)
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planted',
  parent_thread_id TEXT
);

CREATE TABLE IF NOT EXISTS thread_beats (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  time_point_id TEXT,
  scene_id TEXT,
  summary TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  gender TEXT NOT NULL DEFAULT '',
  appearance TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  speech_pattern TEXT NOT NULL DEFAULT '',
  goals TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#9b2d1f'
);

CREATE TABLE IF NOT EXISTS character_states (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  time_point_id TEXT NOT NULL,
  age TEXT NOT NULL DEFAULT '',
  status_title TEXT NOT NULL DEFAULT '',
  faction_id TEXT,
  location_id TEXT,
  rank_id TEXT,
  alive INTEGER NOT NULL DEFAULT 1,
  appearance_override TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS character_events (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  time_point_id TEXT NOT NULL,
  scene_id TEXT,
  summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  label TEXT NOT NULL DEFAULT '',
  start_time_id TEXT,
  end_time_id TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY,
  statement TEXT NOT NULL,
  about_ids TEXT NOT NULL DEFAULT '[]',
  is_secret INTEGER NOT NULL DEFAULT 0,
  true_in_canon INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS character_knowledge (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  fact_id TEXT NOT NULL,
  learned_at_time_id TEXT,
  learned_in_scene_id TEXT,
  believed INTEGER NOT NULL DEFAULT 1,
  forgotten INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS etiquette_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  from_role TEXT NOT NULL DEFAULT '',
  to_role TEXT NOT NULL DEFAULT '',
  required TEXT NOT NULL DEFAULT '',
  forbidden TEXT NOT NULL DEFAULT '',
  consequence TEXT NOT NULL DEFAULT '',
  effective_from_time_id TEXT,
  effective_to_time_id TEXT
);

CREATE TABLE IF NOT EXISTS livelihood (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  location_id TEXT,
  faction_id TEXT
);

CREATE TABLE IF NOT EXISTS rule_systems (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  summary TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS rule_ranks (
  id TEXT PRIMARY KEY,
  system_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS rule_constraints (
  id TEXT PRIMARY KEY,
  system_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  applies_to TEXT NOT NULL DEFAULT '',
  violation_note TEXT NOT NULL DEFAULT '',
  effective_from_time_id TEXT,
  effective_to_time_id TEXT
);

CREATE TABLE IF NOT EXISTS world_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS term_kinds (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  builtin INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#8a8070',
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS terms (
  id TEXT PRIMARY KEY,
  surface TEXT NOT NULL,
  normalized TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  linked_entity_type TEXT,
  linked_entity_id TEXT,
  forbidden_variants TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS address_rules (
  id TEXT PRIMARY KEY,
  speaker_spec TEXT NOT NULL DEFAULT '',
  addressee_spec TEXT NOT NULL DEFAULT '',
  term TEXT NOT NULL,
  formality TEXT NOT NULL DEFAULT 'neutral',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  body TEXT NOT NULL,
  trigger TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS review_jobs (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  snapshot_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS review_issues (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  subtype TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'warn',
  scene_id TEXT,
  span_start INTEGER,
  span_end INTEGER,
  original TEXT NOT NULL DEFAULT '',
  suggestion TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS pending_changes (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  scene_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  target_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  hash TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS world_categories (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL
);
`;
