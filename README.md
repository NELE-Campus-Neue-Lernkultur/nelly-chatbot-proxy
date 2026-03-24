# Nelly Proxy – Open Source Chatbot Infrastructure for NGOs

A lightweight proxy server that connects a customizable chatbot frontend to the [Mistral AI](https://mistral.ai) API. Built by [Education Y e.V.](https://education-y.de) for their learning platform [NELE Campus](https://nele-campus.org), and released as open source so other NGOs can build on it.

**What it does:**
- Keeps your Mistral API key secret (not exposed in your frontend code)
- Logs conversations anonymously for quality review — GDPR-compliant, no IP addresses stored
- Sends a weekly email report of all conversations
- Lets you trigger a full export of the last 180 days on demand

---

## Prerequisites

Before you start, you'll need:

- A **Linux VPS** (e.g. from Strato, Hetzner, or similar) — 1 CPU, 1 GB RAM is sufficient
- A **domain or subdomain** pointing to your server (e.g. `proxy.your-org.org`)
- A **Mistral account** with an API key and a configured Agent — see [Mistral Console](https://console.mistral.ai)
- A **Gmail account** with an [App Password](https://support.google.com/accounts/answer/185833) enabled for sending email reports
- Basic comfort with a terminal (copy-pasting commands is enough)

---

## Server Setup

### 1. Install Node.js and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y
npm install -g pm2
```

### 2. Upload the project files

Copy the project folder to your server:

```bash
scp -r ./nelly-proxy root@YOUR_SERVER_IP:/root/nelly-proxy
```

### 3. Create your configuration file

On the server, copy the example config and fill in your values:

```bash
cd /root/nelly-proxy
cp .env.example .env
nano .env
```

See the [Configuration](#configuration) section below for a description of each field.

### 4. Install dependencies

```bash
npm install
```

### 5. Set up SSL (HTTPS)

Install certbot and get a certificate for your domain:

```bash
apt install certbot -y
certbot certonly --standalone -d proxy.your-org.org
```

Update the certificate paths in `server.js` if your domain differs from the default.

### 6. Start the server

```bash
pm2 start server.js --name nelly-proxy
pm2 save
pm2 startup
```

The server will now start automatically after reboots.

---

## Configuration

### Server configuration (`.env`)

Copy `.env.example` to `.env` and fill in your values:

| Field | Description |
|---|---|
| `MISTRAL_API_KEY` | Your Mistral API key |
| `MISTRAL_AGENT_ID` | The ID of your Mistral Agent (starts with `ag_`) |
| `PORT` | Port the server listens on (default: `443`) |
| `ALLOWED_ORIGINS` | Comma-separated list of domains allowed to use the proxy (e.g. `https://your-org.org,https://www.your-org.org`) |
| `MAIL_USER` | Gmail address used to send reports |
| `MAIL_PASSWORD` | Gmail App Password (not your regular Gmail password) |
| `MAIL_RECIPIENTS` | Comma-separated list of email addresses to receive reports |
| `LOG_RETENTION_DAYS` | How many days conversations are kept before automatic deletion (default: `180`) |
| `EXPORT_TOKEN` | A secret token for the on-demand export link — choose any long random string |

### Chatbot configuration (`chatbot.html`)

Open `chatbot.html` and find the `CONFIG` block at the very top of the script. All visual and textual customizations are in one place — you don't need to touch anything else in the file.

```js
const CONFIG = {
    proxyUrl:       'https://proxy.your-org.org/api/chat',
    pageTitle:      'Your Chatbot Name',
    headerTitle:    'Your header headline',
    botName:        'Your Bot',
    welcomeMessage: 'Hello! I am ...',
    logoUrl:        'https://...',
    avatarUrl:      'https://...',
    headerColor:    '#bff0ed',   // background color of the header
    buttonColor:    '#316879',   // color of the send button and user messages
    fontFamily:     'Work Sans',
    fontUrl:        'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600&display=swap',
    privacyUrl:     'https://your-org.org/privacy',
    privacyNotice:  '...',
    privacyCredit:  '',          // optional: image/avatar credits, leave empty to hide
};
```

**Tips:**
- `headerColor` and `buttonColor` are independent — use your brand's two main colors
- `fontUrl`: find any font on [fonts.google.com](https://fonts.google.com), copy the embed URL, and paste it here. Leave empty to use the system font.
- `privacyNotice` supports HTML. The placeholder `PRIVACY_URL` in the text is automatically replaced with the value of `privacyUrl`.
- `headerTitle` supports HTML — use `<br>` for a line break in the headline.

### Configuring chatbot quality and behavior (Mistral)

The **personality, tone, knowledge, and response quality** of your chatbot are configured directly in the [Mistral Console](https://console.mistral.ai) — not in this codebase.

In Mistral, you set up an **Agent** with a system prompt that defines what your chatbot knows, how it responds, and what topics it covers. The proxy simply forwards conversations to that agent and returns its responses.

To adjust what the chatbot says:
1. Log in to [console.mistral.ai](https://console.mistral.ai)
2. Open your Agent
3. Edit the system prompt
4. Changes take effect immediately — no server restart needed

---

## How conversations are logged

Every exchange (user message + bot response) is stored in a local SQLite database on your server. What is stored:

| Stored | Not stored |
|---|---|
| Session ID (random, anonymous) | IP address |
| Message content | Name or identity of user |
| Timestamp | Browser or device info |

Conversations are automatically deleted after `LOG_RETENTION_DAYS` days.

### Role context across sessions

The first message a user sends is treated as their **role** (e.g. "teacher", "school principal"). This is saved in their browser's local storage and automatically prepended to the conversation on their next visit — so the chatbot remembers their role without asking again.

This behavior assumes your chatbot's first question asks for the user's role. If your chatbot works differently, you can remove the `ROLE_KEY` logic in `chatbot.html`.

---

## Email reports

### Weekly report

Every Monday at 7:00 AM (server time), a report is sent to all addresses in `MAIL_RECIPIENTS` with:
- Number of conversations from the past week
- Full conversation logs as `.txt` (readable) and `.csv` (for Excel)
- A link to trigger a full export on demand

### On-demand export

Click the link in any weekly report email to receive all conversations from the last `LOG_RETENTION_DAYS` days. The link is protected by the `EXPORT_TOKEN` — only people who receive the weekly email can trigger it.

You can also trigger an export manually from the server:

```bash
cd /root/nelly-proxy
node export.js
```

---

## Testing

### Smoke tests (live server)

Run after any change to verify the server is responding correctly:

```bash
bash test.sh
```

This checks:
1. The chat endpoint returns `200`
2. The export endpoint rejects invalid tokens with `403`
3. The export endpoint accepts the correct token with `200`

### Unit tests (logger)

Run on the server to verify the database logic:

```bash
ssh root@YOUR_SERVER_IP "cd /root/nelly-proxy && node logger.test.js"
```

---

## File overview

| File | Purpose |
|---|---|
| `server.js` | Main server: handles requests, forwards to Mistral, runs scheduled jobs |
| `logger.js` | Saves and retrieves conversations from the SQLite database |
| `mailer.js` | Formats and sends email reports |
| `export.js` | CLI script to trigger a full export manually |
| `chatbot.html` | The chatbot frontend — deploy this to your website |
| `logger.test.js` | Unit tests for the logger |
| `test.sh` | Smoke tests for the live server |
| `.env` | Your configuration (never commit this file) |
| `.env.example` | Template for `.env` — safe to commit |

---

## License

MIT — feel free to use, adapt, and share. If you build on this for your NGO, we'd love to hear about it.
