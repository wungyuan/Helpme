import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  creator_token TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  -- 可见性：private 接力者只看到直接相连的人；public 可见完整上游链条
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
  -- 求助性质：paid 有偿 / friendship 友情帮助；reward_note 为附言说明
  reward_type TEXT NOT NULL CHECK (reward_type IN ('paid', 'friendship')),
  reward_note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  parent_node_id TEXT REFERENCES nodes(id),
  visitor_token TEXT NOT NULL,
  nickname TEXT NOT NULL,
  relation_strength INTEGER CHECK (relation_strength IN (1, 2, 3)),
  forward_note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id),
  contact TEXT NOT NULL,
  message TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_request ON nodes(request_id);
CREATE INDEX IF NOT EXISTS idx_claims_node ON claims(node_id);
`;

export function createDb(dbPath: string): Database.Database {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

let singleton: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!singleton) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'helpme.db');
    singleton = createDb(dbPath);
  }
  return singleton;
}
