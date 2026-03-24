// -----------------------------------------------
// Logger – speichert Gespräche in SQLite-Datenbank
// -----------------------------------------------

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ordner für Datenbankdatei anlegen falls nicht vorhanden
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(process.env.DB_PATH || path.join(dataDir, 'conversations.db'));

// Tabellen anlegen beim ersten Start
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL UNIQUE,
    started_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL,
    role            TEXT NOT NULL,   -- 'user' oder 'assistant'
    content         TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Duplikate in bestehenden Datenbanken bereinigen und UNIQUE-Index sicherstellen
db.exec(`
  DELETE FROM conversations
  WHERE id NOT IN (
    SELECT MIN(id) FROM conversations GROUP BY session_id
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
`);

const insertConversation = db.prepare(
  `INSERT OR IGNORE INTO conversations (session_id) VALUES (?)`
);

const insertMessage = db.prepare(
  `INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)`
);

// Speichert eine Nutzer-Eingabe und die Antwort von Mistral
function logExchange(sessionId, userMessage, assistantMessage) {
  insertConversation.run(sessionId);
  insertMessage.run(sessionId, 'user', userMessage);
  insertMessage.run(sessionId, 'assistant', assistantMessage);
}

// Gibt alle Gespräche eines Zeitraums zurück (für den Wochenbericht)
function getConversationsSince(date) {
  return db.prepare(`
    SELECT
      c.session_id,
      c.started_at,
      m.role,
      m.content,
      m.created_at
    FROM conversations c
    JOIN messages m ON m.session_id = c.session_id
    WHERE c.started_at >= ?
    ORDER BY c.started_at ASC, m.created_at ASC, m.id ASC
  `).all(date.toISOString());
}

// Löscht Einträge die älter als LOG_RETENTION_DAYS sind
function deleteOldLogs() {
  const days = parseInt(process.env.LOG_RETENTION_DAYS) || 90;
  db.prepare(`
    DELETE FROM messages
    WHERE created_at < datetime('now', '-' || ? || ' days')
  `).run(days);
  db.prepare(`
    DELETE FROM conversations
    WHERE session_id NOT IN (SELECT DISTINCT session_id FROM messages)
  `).run();
}

module.exports = { logExchange, getConversationsSince, deleteOldLogs };
