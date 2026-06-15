import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  creator_token TEXT NOT NULL,
  -- 发起人手机号（数字）：用于跨设备找回自己发起的求助
  creator_phone TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  -- 求助配图 URL（可选）
  image_url TEXT,
  -- 可见性：private 接力者只看到直接相连的人；public 可见完整上游链条
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
  -- 求助性质：paid 有偿 / friendship 友情帮助；reward_note 为附言说明
  reward_type TEXT NOT NULL CHECK (reward_type IN ('paid', 'friendship')),
  reward_note TEXT,
  -- 终止条件：达到匹配数量 或 到达截止时间，任一满足即停止接力/认领（均可为空=不限）
  target_match_count INTEGER,
  deadline_at INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  parent_node_id TEXT REFERENCES nodes(id),
  visitor_token TEXT NOT NULL,
  nickname TEXT NOT NULL,
  -- 接力者留给“直接上一跳”的联系方式：私密必填、公开选填，仅直接上一跳与开发者后台可见
  contact TEXT,
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

// 轻量迁移：为已存在的表补列（CREATE TABLE IF NOT EXISTS 不会改动已有表结构）
function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

export function createDb(dbPath: string): Database.Database {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  ensureColumn(db, 'nodes', 'contact', 'contact TEXT');
  ensureColumn(db, 'requests', 'target_match_count', 'target_match_count INTEGER');
  ensureColumn(db, 'requests', 'deadline_at', 'deadline_at INTEGER');
  ensureColumn(db, 'requests', 'creator_phone', 'creator_phone TEXT');
  ensureColumn(db, 'requests', 'image_url', 'image_url TEXT');
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
