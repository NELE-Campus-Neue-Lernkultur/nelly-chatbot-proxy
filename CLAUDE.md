# NELE Chatbot – Projekthinweise für Claude

## Sprache & Schreibweise

- **Genderzeichen:** Immer Asterisk `*` verwenden, niemals Doppelpunkt `:`.
  - Richtig: `Schüler*innen`, `Kolleg*innen`, `Nutzer*innen`
  - Falsch: `Schüler:innen`, `Kolleg:innen`

## Projektstruktur

- `chatbot.html` – Standalone-Version (vollständige HTML-Seite)
- `chatbot-embed.html` – Webflow-Embed-Version (kein `<html>`/`<body>`, scoped CSS mit `#nele-chatbot`)
- Beide Dateien teilen dieselbe Konfigurationslogik (CONFIG-Block) und denselben Datenschutzhinweis-Text.

## Deployment

- Proxy-Server: `https://proxy.nele-campus.org/api/chat`
- GitHub-Repo: `NELE-Campus-Neue-Lernkultur/nelly-chatbot-proxy`
- Branch: `main`
