// -----------------------------------------------
// Export – sendet alle gespeicherten Gespräche per E-Mail
// Aufruf: node export.js
// -----------------------------------------------

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { sendFullExport } = require('./mailer');

sendFullExport().catch(e => console.error('[Export] Fehler:', e.message));
