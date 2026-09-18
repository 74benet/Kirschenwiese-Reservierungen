# Kirschenwiese Reservierungen

Web-App für die Pizzeria Kirschenwiese. Sie liest Reservierungsanfragen aus dem E-Mail-Postfach, speichert sie in einer Datenbank und zeigt sie dem Personal übersichtlich an. Man kann Reservierungen annehmen oder ablehnen, bekommt eine Push-Benachrichtigung aufs Handy und kann alle Reservierungen als Kalender abonnieren.

## Funktionen

- **Reservierungsliste**: Name, Personenzahl, Reservierungsdatum und Eingangsdatum, sortierbar nach Eingangs- oder Reservierungsdatum
- **Annehmen / Ablehnen** per vorbereiteter Antwort-Mail, Status „erledigt“ bzw. „ungelesen“
- **Automatischer Abgleich** mit dem Postfach: nur neue E-Mails werden geladen, Antworten („AW:“) markieren Reservierungen als erledigt
- **Passwortschutz** mit einem gemeinsamen Passwort fürs Personal (wird auf dem Gerät gemerkt)
- **Push-Benachrichtigungen** bei neuen Reservierungen (auch auf dem iPhone, wenn die Seite als App zum Home-Bildschirm hinzugefügt wurde, ab iOS 16.4)
- **Kalender-Abo (ICS)**: Reservierungen der letzten 30 Tage und alle kommenden direkt im Kalender, z. B. auf dem iPhone

## Architektur

```
Postfach (IMAP, Alfahosting)
        │  alle 2 Minuten (Cloud Scheduler) bzw. beim Öffnen der App
        ▼
Node.js/Express-Server ──► PostgreSQL (Supabase)
        │
        ├── React-Frontend (wird vom selben Server ausgeliefert)
        ├── Push-Benachrichtigungen (Web Push)
        └── Kalender-Abo (/kalender/<schlüssel>.ics)
```

- **Frontend**: React + MUI (`src/`)
- **Backend**: Node.js + Express (`server/`)
- **Datenbank**: PostgreSQL bei Supabase (Tabellen `emails` und `push_subscriptions`)
- **Hosting**: ein einziger Container auf Google Cloud Run

## Lokal starten

Voraussetzung: Node.js 20 oder neuer und eine `.env` im Hauptordner (siehe unten).

```bash
# Backend (Port 8080)
cd server
npm install
npm start

# Frontend im Entwicklungsmodus (Port 3000), in einem zweiten Terminal
npm install
npm start
```

Für den Entwicklungsmodus in der `.env` `REACT_APP_BACKEND_URL=http://localhost:8080` setzen. Ohne diesen Wert spricht das Frontend den Server an, von dem es geladen wurde (so läuft es im Container).

Alternativ alles in einem Prozess wie in der Produktion:

```bash
npm install && npm run build
rm -rf server/public && cp -r build server/public
cd server && npm start      # http://localhost:8080
```

Mit Docker und eigener lokaler Datenbank: `docker-compose up --build`, danach läuft die App unter http://localhost:8080.

## Umgebungsvariablen (`.env`)

Die `.env` gehört nicht ins Repository. In der Produktion liegen die Werte im Google Secret Manager.

| Variable | Beschreibung |
|---|---|
| `REACT_APP_USER`, `REACT_APP_PASSWORD` | Zugangsdaten des Postfachs |
| `REACT_APP_HOST`, `REACT_APP_PORT` | IMAP-Server und Port (993) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Datenbank. Bei Supabase den **Session Pooler** verwenden (der direkte Host ist nur per IPv6 erreichbar) |
| `DB_SSL` | `true` für Supabase |
| `APP_PASSWORD` | Passwort fürs Personal. Ohne Wert ist die App ungeschützt (nur lokal sinnvoll) |
| `CALENDAR_TOKEN` | Geheimer Teil der Kalender-Adresse |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Schlüssel für Push-Benachrichtigungen (erzeugen mit `npx web-push generate-vapid-keys`) |
| `TZ` | `Europe/Berlin` |
| `REACT_APP_BACKEND_URL` | Nur für den Entwicklungsmodus, siehe oben |
| `SYNC_INTERVAL_MS` | Optional: Abstand der Abgleiche in Millisekunden (Standard 60000) |
| `IMAP_DEBUG` | Optional: `true` für ausführliche IMAP-Protokolle |

## Deployment (Google Cloud Run)

Projekt `cogent-reach-430413-v5`, Region `europe-west1`, Dienst `frontend`. Google baut den Container aus dem `Dockerfile` selbst, lokal wird kein Docker gebraucht:

```bash
gcloud run deploy frontend --project cogent-reach-430413-v5 --region europe-west1 --source .
```

Umgebungsvariablen und Secrets bleiben beim erneuten Deployen erhalten. Neue Secrets mit `--update-secrets NAME=NAME:latest` hinzufügen.

Der Cloud-Scheduler-Auftrag `kirschenwiese-mail-sync` ruft alle 2 Minuten `POST /refresh-emails` auf, damit neue Reservierungen auch ohne geöffnete App ankommen und Push-Benachrichtigungen verschickt werden. Er schickt das App-Passwort im Header `X-App-Password` mit. **Wird `APP_PASSWORD` geändert, muss auch der Header im Scheduler-Auftrag angepasst werden.**

## Nutzung auf dem iPhone

- **Als App**: Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“
- **Push-Benachrichtigungen**: App über das Home-Bildschirm-Symbol öffnen, auf die Glocke tippen und erlauben
- **Kalender**: in der App auf das Kalender-Symbol tippen → „Direkt abonnieren“

## API

Alle Routen außer dem Kalender verlangen den Header `X-App-Password`.

| Route | Beschreibung |
|---|---|
| `GET /emails?sortBy=input\|date` | Reservierungsliste (ohne E-Mail-Text) |
| `GET /emails/:id/text` | Kompletter E-Mail-Text |
| `POST /emails/:id/status` | Status setzen, Body `{ "status": true }` |
| `POST /refresh-emails` | Postfach sofort abgleichen |
| `GET /sync-status` | Stand des letzten Abgleichs |
| `GET /calendar-url` | Adresse des Kalender-Abos |
| `GET /push/public-key`, `POST /push/subscribe`, `POST /push/unsubscribe` | Push-Benachrichtigungen |
| `GET /kalender/<CALENDAR_TOKEN>.ics` | Kalender-Abo (ohne Passwort, der Schlüssel in der Adresse schützt) |
