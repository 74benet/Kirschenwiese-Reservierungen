// server.mjs

// Importieren von benötigten Modulen:
// - express: Web-Framework für Node.js
// - cors: Middleware, die Cross-Origin Resource Sharing (CORS) ermöglicht
// - dotenv: Zum Laden von Umgebungsvariablen aus einer .env-Datei
// - ImapService: Klasse für die IMAP-Verbindung, um E-Mails abzurufen
// - EmailProcessor: Funktionen zur Verarbeitung von E-Mails
// - EmailDatabaseService: Klasse zur Einbindung der Datenbank
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ImapService } from './models/ImapService.mjs';
import { isRelevantSubject, processMessages } from './models/EmailProcessor.mjs';
import { EmailDatabaseService } from './db/DatabaseService.mjs';

// Laden der Umgebungsvariablen aus der .env-Datei (über den angegebenen Pfad)
dotenv.config({ path: '../.env' });

// Initialisierung der Express-Anwendung
const app = express();
const port = process.env.PORT || 8080;
// Wie oft der Server selbstständig nach neuen E-Mails schaut (Standard: 60 Sekunden)
const syncIntervalMs = Number(process.env.SYNC_INTERVAL_MS) || 60_000;

app.use(cors());
app.use(express.json());

// Passwortschutz für alle Daten-Routen. Das Frontend schickt das Passwort im Header "X-App-Password".
// Ohne APP_PASSWORD (z. B. lokal) ist der Schutz aus.
const appPassword = process.env.APP_PASSWORD || '';
if (!appPassword) console.warn('Achtung: APP_PASSWORD ist nicht gesetzt, die Daten sind ohne Passwort abrufbar.');

const passwordMatches = (given) => {
    const a = crypto.createHash('sha256').update(String(given ?? '')).digest();
    const b = crypto.createHash('sha256').update(appPassword).digest();
    return crypto.timingSafeEqual(a, b);
};

const requirePassword = (req, res, next) => {
    if (!appPassword || passwordMatches(req.get('X-App-Password'))) return next();
    // Kleine Verzögerung erschwert das Durchprobieren von Passwörtern
    setTimeout(() => res.status(401).json({ message: 'Falsches Passwort' }), 1000);
};

app.use(['/emails', '/refresh-emails', '/sync-status', '/auth-check'], requirePassword);

// Zum Prüfen des Passworts beim Anmelden
app.get('/auth-check', (req, res) => res.json({ ok: true }));

// Konfiguration für die IMAP-Verbindung (wird aus den Umgebungsvariablen geladen)
const imapConfig = {
    user: process.env.REACT_APP_USER,
    password: process.env.REACT_APP_PASSWORD,
    host: process.env.REACT_APP_HOST,
    port: process.env.REACT_APP_PORT,
    tls: true,
    connTimeout: 30000,
    authTimeout: 30000,
    // Nur bei Bedarf aktivieren: protokolliert sonst jede E-Mail komplett und bremst stark
    debug: process.env.IMAP_DEBUG === 'true' ? console.log : undefined,
};

const imapService = new ImapService(imapConfig);
const db = new EmailDatabaseService();

// Zustand des E-Mail-Abgleichs. Nach dem ersten vollständigen Abruf werden nur noch neue E-Mails geholt.
const syncState = {
    lastUid: 0,
    uidValidity: null,
    lastSync: null,
    lastError: null,
};
let runningSync = null;

const runSync = async () => {
    const started = Date.now();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { messages, maxUid, uidValidity, incremental } = await imapService.fetchMessages({
        since: threeMonthsAgo,
        afterUid: syncState.lastUid,
        uidValidity: syncState.uidValidity,
        isRelevantSubject,
    });

    const { reservations, replies } = processMessages(messages);
    const added = await db.saveReservations(reservations);
    // Antworten auf ältere, schon gespeicherte Reservierungen nur bei neuen E-Mails übernehmen,
    // damit ein manuell auf "ungelesen" gesetzter Eintrag nach einem Neustart nicht überschrieben wird
    const answered = incremental ? await db.markAnswered(replies) : 0;

    // Erst nach erfolgreichem Speichern weiterzählen, sonst würden E-Mails beim nächsten Mal übersprungen
    syncState.lastUid = maxUid;
    syncState.uidValidity = uidValidity;
    syncState.lastSync = new Date();
    syncState.lastError = null;

    const result = { added, answered, checked: messages.length, durationMs: Date.now() - started };
    console.log(`E-Mail-Abgleich (${incremental ? 'inkrementell' : 'vollständig'}):`, result);
    return result;
};

// Es läuft immer höchstens ein Abgleich gleichzeitig. Weitere Aufrufe warten auf den laufenden.
const syncEmails = () => {
    if (!runningSync) {
        runningSync = runSync()
            .catch((err) => {
                syncState.lastError = err.message;
                console.error('Fehler beim Aktualisieren der E-Mails:', err);
                throw err;
            })
            .finally(() => {
                runningSync = null;
            });
    }
    return runningSync;
};

// Ist der letzte Abgleich zu alt, wird vorher abgeglichen. Nötig z. B. auf Cloud Run,
// wo der Server ohne Anfragen schläft und der Hintergrund-Abgleich nicht läuft.
const syncIfStale = async () => {
    const age = syncState.lastSync ? Date.now() - syncState.lastSync.getTime() : Infinity;
    if (age < syncIntervalMs && !runningSync) return;
    try {
        await syncEmails();
    } catch {
        // Fehler ist schon protokolliert, die vorhandenen Daten werden trotzdem ausgeliefert
    }
};

// GET-Route zum Abrufen der E-Mails (sortBy: "input" = Eingangsdatum, "date" = Reservierungsdatum)
app.get('/emails', async (req, res) => {
    try {
        await syncIfStale();
        res.json(await db.listEmails(req.query.sortBy));
    } catch (err) {
        console.error('Fehler beim Abrufen der E-Mails:', err);
        res.status(500).json({ message: 'Fehler beim Abrufen der E-Mails' });
    }
});

// POST-Route zum manuellen Aktualisieren der E-Mails. Antwortet erst, wenn wirklich alles gespeichert ist.
app.post('/refresh-emails', async (req, res) => {
    try {
        const result = await syncEmails();
        res.json({ message: 'E-Mails wurden aktualisiert', ...result });
    } catch (err) {
        res.status(502).json({ message: 'E-Mails konnten nicht vom Mailserver abgerufen werden', error: err.message });
    }
});

// Status des Abgleichs (z. B. zur Fehlersuche)
app.get('/sync-status', (req, res) => {
    res.json({ ...syncState, running: Boolean(runningSync) });
});

// Kompletter E-Mail-Text einer Reservierung (wird erst beim Öffnen der Nachricht geladen)
app.get('/emails/:id/text', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Ungültige ID' });

    try {
        const text = await db.getEmailText(id);
        if (text === null) return res.status(404).json({ message: 'Email not found' });
        res.json({ text });
    } catch (err) {
        console.error('Fehler beim Abrufen des E-Mail-Texts:', err);
        res.status(500).json({ message: 'Fehler beim Abrufen des E-Mail-Texts' });
    }
});

// Setzt den Status (erledigt / ungelesen) einer Reservierung anhand ihrer ID
app.post('/emails/:id/status', async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(id) || typeof status !== 'boolean') {
        return res.status(400).json({ message: 'Ungültige ID oder Status' });
    }

    try {
        const row = await db.setStatus(id, status);
        if (!row) return res.status(404).json({ message: 'Email not found' });
        res.json(row);
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Status:', err);
        res.status(500).json({ message: 'Fehler beim Aktualisieren des Status' });
    }
});

// Liegt das gebaute Frontend im Ordner "public" (siehe Dockerfile), liefert der Server es gleich mit aus
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

const start = async () => {
    try {
        await db.ensureSchema();
    } catch (err) {
        console.error('Datenbank nicht erreichbar oder Tabelle konnte nicht angelegt werden:', err.message);
    }

    app.listen(port, '0.0.0.0', () => {
        console.log(`Server läuft auf Port ${port}`);
    });

    // Erster Abgleich beim Start, danach regelmäßig im Hintergrund
    syncEmails().catch(() => {});
    setInterval(() => syncEmails().catch(() => {}), syncIntervalMs);
};

start();
