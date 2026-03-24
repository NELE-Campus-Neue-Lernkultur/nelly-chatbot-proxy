// -----------------------------------------------
// Mailer – versendet wöchentlichen Gesprächsbericht
// -----------------------------------------------

const nodemailer = require('nodemailer');
const { getConversationsSince } = require('./logger');

const PROXY_URL = process.env.PROXY_URL || 'https://proxy.nele-campus.org';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

// Gespräche als lesbaren Text formatieren
function formatAsTxt(conversations) {
  if (conversations.length === 0) return 'Keine Gespräche in dieser Woche.\n';

  // Gespräche nach session_id gruppieren
  const sessions = {};
  for (const row of conversations) {
    if (!sessions[row.session_id]) {
      sessions[row.session_id] = { started_at: row.started_at, messages: [] };
    }
    sessions[row.session_id].messages.push({ role: row.role, content: row.content });
  }

  let txt = '';
  let count = 1;
  for (const [sessionId, session] of Object.entries(sessions)) {
    const date = new Date(session.started_at).toLocaleString('de-DE');
    txt += `─────────────────────────────\n`;
    txt += `Gespräch #${count} – ${date}\n`;
    txt += `─────────────────────────────\n`;
    for (const msg of session.messages) {
      const label = msg.role === 'user' ? 'Nutzer:  ' : 'Nelly:   ';
      txt += `${label}${msg.content}\n\n`;
    }
    txt += '\n';
    count++;
  }
  return txt;
}

// Gespräche als CSV formatieren
function formatAsCsv(conversations) {
  const header = 'session_id;datum;rolle;nachricht\n';
  const rows = conversations.map(row => {
    const date = new Date(row.created_at).toLocaleString('de-DE');
    const content = row.content.replace(/"/g, '""').replace(/\n/g, ' ');
    return `"${row.session_id}";"${date}";"${row.role}";"${content}"`;
  });
  return header + rows.join('\n');
}

async function sendWeeklyReport() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const conversations = getConversationsSince(oneWeekAgo);

  // Kalenderwoche berechnen
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const kw = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);

  // Anzahl einzigartiger Gespräche
  const sessionCount = new Set(conversations.map(r => r.session_id)).size;

  const txtContent = formatAsTxt(conversations);
  const csvContent = formatAsCsv(conversations);

  const exportLink = `${PROXY_URL}/export?token=${process.env.EXPORT_TOKEN}`;

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: process.env.MAIL_RECIPIENTS,
    subject: `Nelly – Gesprächslog KW ${kw}`,
    text: `Wochenbericht Nelly-Chatbot – KW ${kw}\n\nGespräche diese Woche: ${sessionCount}\n\nDie vollständigen Logs findest du im Anhang.\n\n──────────────────────────────\nAlle Gespräche der letzten 180 Tage abrufen:\n${exportLink}\n`,
    attachments: [
      {
        filename: `nelly-log-kw${kw}.txt`,
        content: txtContent,
        encoding: 'utf-8',
      },
      {
        filename: `nelly-log-kw${kw}.csv`,
        content: csvContent,
        encoding: 'utf-8',
      },
    ],
  });

  console.log(`[Mailer] Wochenbericht KW ${kw} versendet (${sessionCount} Gespräche)`);
}

async function sendFullExport() {
  const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 180;
  const since = new Date();
  since.setDate(since.getDate() - retentionDays);
  const conversations = getConversationsSince(since);

  const sessions = {};
  for (const row of conversations) {
    if (!sessions[row.session_id]) {
      sessions[row.session_id] = { started_at: row.started_at, messages: [] };
    }
    sessions[row.session_id].messages.push({ role: row.role, content: row.content });
  }

  const txtContent = formatAsTxt(conversations);
  const csvContent = formatAsCsv(conversations);

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: process.env.MAIL_RECIPIENTS,
    subject: `Nelly – Gesprächsexport letzte ${retentionDays} Tage (${new Date().toLocaleDateString('de-DE')})`,
    text: `Export der letzten ${retentionDays} Tage.\n\nGespräche gesamt: ${Object.keys(sessions).length}\n`,
    attachments: [
      { filename: 'nelly-export-komplett.txt', content: txtContent, encoding: 'utf-8' },
      { filename: 'nelly-export-komplett.csv', content: csvContent, encoding: 'utf-8' },
    ],
  });

  console.log(`[Mailer] Vollständiger Export versendet (${Object.keys(sessions).length} Gespräche)`);
}

module.exports = { sendWeeklyReport, sendFullExport };
