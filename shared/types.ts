export type ChapterStatus = "draft" | "final";
export type ThreadType = "main" | "overt" | "covert" | "foreshadow";
export type ThreadStatus = "planted" | "active" | "paid_off" | "abandoned";
export type BeatKind = "plant" | "progress" | "payoff" | "abandon";
export type ReviewKind = "language" | "continuity";
export type IssueStatus = "pending" | "accepted" | "rejected" | "ignored";
export type ChangeStatus = "pending" | "accepted" | "rejected";
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface ProjectMeta {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  timeline_mode: "relative" | "calendar";
  word_count_mode: "no_space" | "han_only" | "all";
}

export interface Volume {
  id: string;
  title: string;
  sort_order: number;
  summary: string;
}

export interface Chapter {
  id: string;
  volume_id: string;
  title: string;
  sort_order: number;
  summary: string;
  status: ChapterStatus;
  body: string;
  word_count: number;
  deleted_at: string | null;
}

export interface Scene {
  id: string;
  chapter_id: string;
  sort_order: number;
  title: string;
  summary: string;
  time_point_id: string | null;
  location_id: string | null;
  pov_character_id: string | null;
  word_count: number;
  presence: string[];
  threads: { thread_id: string; beat_id: string | null }[];
}

export interface TimePoint {
  id: string;
  sort_key: number;
  label: string;
  era: string | null;
  year: number | null;
  month: number | null;
  day: number | null;
  season: string | null;
  hour: number | null;
  notes: string;
}

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  gender: string;
  appearance: string;
  personality: string;
  speech_pattern: string;
  goals: string;
  notes: string;
  color: string;
}

export interface CharacterState {
  id: string;
  character_id: string;
  time_point_id: string;
  age: string;
  status_title: string;
  faction_id: string | null;
  location_id: string | null;
  rank_id: string | null;
  alive: number;
  appearance_override: string;
  notes: string;
}

export interface CharacterEvent {
  id: string;
  character_id: string;
  time_point_id: string;
  scene_id: string | null;
  summary: string;
}

export interface Relationship {
  id: string;
  from_id: string;
  to_id: string;
  type: string;
  label: string;
  start_time_id: string | null;
  end_time_id: string | null;
  notes: string;
}

export interface Fact {
  id: string;
  statement: string;
  about_ids: string[];
  is_secret: number;
  true_in_canon: number;
}

export interface CharacterKnowledge {
  id: string;
  character_id: string;
  fact_id: string;
  learned_at_time_id: string | null;
  learned_in_scene_id: string | null;
  believed: number;
  forgotten: number;
}

export interface Faction {
  id: string;
  name: string;
  summary: string;
  hierarchy_notes: string;
  parent_faction_id: string | null;
  effective_from_time_id: string | null;
  effective_to_time_id: string | null;
}

export interface Location {
  id: string;
  name: string;
  parent_id: string | null;
  summary: string;
  controlling_faction_id: string | null;
  map_x: number | null;
  map_y: number | null;
  effective_from_time_id: string | null;
  effective_to_time_id: string | null;
}

export interface EtiquetteRule {
  id: string;
  name: string;
  context: string;
  from_role: string;
  to_role: string;
  required: string;
  forbidden: string;
  consequence: string;
  effective_from_time_id: string | null;
  effective_to_time_id: string | null;
}

export interface LivelihoodEntry {
  id: string;
  title: string;
  body: string;
  location_id: string | null;
  faction_id: string | null;
}

export interface RuleSystem {
  id: string;
  name: string;
  kind: string;
  summary: string;
}

export interface RuleRank {
  id: string;
  system_id: string;
  name: string;
  sort_order: number;
  notes: string;
}

export interface RuleConstraint {
  id: string;
  system_id: string;
  statement: string;
  applies_to: string;
  violation_note: string;
  effective_from_time_id: string | null;
  effective_to_time_id: string | null;
}

export interface WorldEntry {
  id: string;
  category: string;
  title: string;
  body: string;
}

export interface Thread {
  id: string;
  name: string;
  summary: string;
  type: ThreadType;
  status: ThreadStatus;
  parent_thread_id: string | null;
}

export interface ThreadBeat {
  id: string;
  thread_id: string;
  kind: BeatKind;
  time_point_id: string | null;
  scene_id: string | null;
  summary: string;
}

export interface Term {
  id: string;
  surface: string;
  normalized: string;
  kind: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  forbidden_variants: string[];
  notes: string;
}

export interface AddressRule {
  id: string;
  speaker_spec: string;
  addressee_spec: string;
  term: string;
  formality: string;
  notes: string;
}

export interface Snapshot {
  id: string;
  chapter_id: string;
  created_at: string;
  body: string;
  trigger: string;
  note: string;
}

export interface ReviewJob {
  id: string;
  chapter_id: string;
  snapshot_id: string | null;
  status: JobStatus;
  created_at: string;
  finished_at: string | null;
  error: string | null;
}

export interface ReviewIssue {
  id: string;
  job_id: string;
  kind: ReviewKind;
  subtype: string;
  severity: string;
  scene_id: string | null;
  span_start: number | null;
  span_end: number | null;
  original: string;
  suggestion: string;
  explanation: string;
  status: IssueStatus;
}

export interface PendingChange {
  id: string;
  job_id: string;
  chapter_id: string;
  scene_id: string | null;
  action: string;
  entity_type: string;
  target_id: string | null;
  payload: Record<string, unknown>;
  reason: string;
  status: ChangeStatus;
  hash: string;
}

export interface TreeVolume extends Volume {
  chapters: TreeChapter[];
}

export interface TreeChapter {
  id: string;
  title: string;
  sort_order: number;
  status: ChapterStatus;
  word_count: number;
  scenes: { id: string; title: string; word_count: number }[];
}

export interface RecentProject {
  name: string;
  path: string;
  opened_at: string;
}

export type ViewId =
  | "write"
  | "timeline"
  | "characters"
  | "world"
  | "threads"
  | "glossary"
  | "search"
  | "settings";
