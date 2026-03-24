// -----------------------------------------------
// Server – API Gateway für den Nelly-Chatbot
// -----------------------------------------------

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { logExchange, deleteOldLogs } = require('./logger');
const { sendWeeklyReport, sendFullExport } = require('./mailer');

const app = express();

// Nur Anfragen von erlaubten Domains zulassen
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Zugriff verweigert für: ${origin}`);
      callback(null, false);
    }
  }
}));
app.use(express.json());

// -----------------------------------------------
// Route: Chatbot-Anfrage weiterleiten
// POST /api/chat
// -----------------------------------------------
app.post('/api/chat', async (req, res) => {
  const { sessionId, messages } = req.body;

  if (!sessionId || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Ungültige Anfrage' });
  }

  try {
    // Anfrage an Mistral weiterleiten
    const mistralResponse = await fetch('https://api.mistral.ai/v1/agents/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        agent_id: process.env.MISTRAL_AGENT_ID,
        messages,
      }),
    });

    if (!mistralResponse.ok) {
      const error = await mistralResponse.json().catch(() => ({}));
      throw new Error(error.message || `Mistral Fehler: ${mistralResponse.status}`);
    }

    const data = await mistralResponse.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error('Unerwartetes Antwortformat von Mistral');
    }

    // Letzte Nutzereingabe und Antwort loggen
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      logExchange(sessionId, lastUserMessage.content, assistantMessage);
    }

    res.json({ message: assistantMessage });

  } catch (error) {
    console.error('[Server] Fehler:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------
// Route: Vollständigen Export auslösen
// GET /export?token=SECRET
// -----------------------------------------------
app.get('/export', async (req, res) => {
  const { token } = req.query;

  if (!token || token !== process.env.EXPORT_TOKEN) {
    return res.status(403).send('Zugriff verweigert.');
  }

  try {
    await sendFullExport();
    res.send('Export wurde versendet. Bitte E-Mail prüfen.');
  } catch (error) {
    console.error('[Export] Fehler:', error.message);
    res.status(500).send('Fehler beim Versand. Bitte Logs prüfen.');
  }
});

// -----------------------------------------------
// Automatische Jobs
// -----------------------------------------------

// Wöchentlicher Bericht: jeden Montag um 7:00 Uhr
cron.schedule('0 7 * * 1', async () => {
  console.log('[Cron] Starte wöchentlichen Bericht...');
  try {
    await sendWeeklyReport();
  } catch (error) {
    console.error('[Cron] Fehler beim E-Mail-Versand:', error.message);
  }
});

// Alte Logs löschen: jeden Tag um 3:00 Uhr
cron.schedule('0 3 * * *', () => {
  console.log('[Cron] Alte Logs werden gelöscht...');
  deleteOldLogs();
});

// -----------------------------------------------
// Server starten
// -----------------------------------------------
const PORT = process.env.PORT || 443;

const sslOptions = {
  cert: fs.readFileSync('/etc/letsencrypt/live/proxy.nele-campus.org/fullchain.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/proxy.nele-campus.org/privkey.pem'),
};

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`[Server] Nelly Proxy läuft auf Port ${PORT} (HTTPS)`);
});
