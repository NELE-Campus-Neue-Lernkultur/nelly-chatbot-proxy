// -----------------------------------------------
// Tests für logger.js
// Aufruf: node logger.test.js
// -----------------------------------------------

process.env.DB_PATH = ':memory:';
process.env.LOG_RETENTION_DAYS = '90';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { logExchange, getConversationsSince, deleteOldLogs } = require('./logger');

// Eindeutige IDs damit parallele Tests sich nicht gegenseitig stören
let counter = 0;
const uid = () => `test-session-${Date.now()}-${++counter}`;

test('logExchange speichert Nutzer- und Assistentnachricht', () => {
  const id = uid();
  logExchange(id, 'Hallo Nelly', 'Hallo! Wie kann ich helfen?');

  const rows = getConversationsSince(new Date(0)).filter(r => r.session_id === id);
  assert.equal(rows.length, 2);

  const userMsg = rows.find(r => r.role === 'user');
  const assistantMsg = rows.find(r => r.role === 'assistant');
  assert.ok(userMsg, 'Nutzernachricht fehlt');
  assert.ok(assistantMsg, 'Assistentnachricht fehlt');
  assert.equal(userMsg.content, 'Hallo Nelly');
  assert.equal(assistantMsg.content, 'Hallo! Wie kann ich helfen?');
});

test('logExchange legt session_id nur einmal in conversations an', () => {
  const id = uid();
  logExchange(id, 'Frage 1', 'Antwort 1');
  logExchange(id, 'Frage 2', 'Antwort 2');

  const rows = getConversationsSince(new Date(0)).filter(r => r.session_id === id);
  assert.equal(rows.length, 4);
  // started_at ist für alle Nachrichten derselben Session identisch
  assert.equal(new Set(rows.map(r => r.started_at)).size, 1);
});

test('getConversationsSince filtert nach Datum', () => {
  const id = uid();
  logExchange(id, 'Test', 'OK');

  const all = getConversationsSince(new Date(0)).filter(r => r.session_id === id);
  assert.equal(all.length, 2);

  // Zukünftiges Datum → leeres Ergebnis
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const none = getConversationsSince(future).filter(r => r.session_id === id);
  assert.equal(none.length, 0);
});

test('deleteOldLogs läuft ohne Fehler durch', () => {
  assert.doesNotThrow(() => deleteOldLogs());
});
