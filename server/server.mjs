// server.mjs

// Importieren von benötigten Modulen:
// - express: Web-Framework für Node.js
// - cors: Middleware, die Cross-Origin Resource Sharing (CORS) ermöglicht
// - dotenv: Zum Laden von Umgebungsvariablen aus einer .env-Datei
// - ImapService: Klasse für die IMAP-Verbindung, um E-Mails abzurufen
// - EmailProcessor: Klasse zur Verarbeitung von E-Mails
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ImapService } from './models/ImapService.mjs';
import { EmailProcessor } from './models/EmailProcessor.mjs';

// Laden der Umgebungsvariablen aus der .env-Datei (über den angegebenen Pfad)
dotenv.config({ path: '../.env' });

// Initialisierung der Express-Anwendung
const app = express();
const port = process.env.PORT || 8080; // Port, auf dem der Server laufen soll

// Hinzufügen von CORS-Middleware, um Cross-Origin-Anfragen zu erlauben
app.use(cors());

// Variable zum Speichern der E-Mails, die vom IMAP-Server abgerufen wurden
let storedEmails = [];

// Konfiguration für die IMAP-Verbindung (wird aus den Umgebungsvariablen geladen)
const imapConfig = {
    user: process.env.REACT_APP_USER,       // IMAP-Benutzername
    password: process.env.REACT_APP_PASSWORD, // IMAP-Passwort
    host: process.env.REACT_APP_HOST,       // IMAP-Host-Adresse
    port: process.env.REACT_APP_PORT,       // IMAP-Port
    tls: true,                              // TLS-Option für sichere Verbindung
    connTimeout: 30000,                     // Timeout für Verbindungsaufbau
    authTimeout: 30000,                     // Timeout für Authentifizierung
    debug: console.log,                     // Debugging-Option (Protokollausgabe)
};

// Instanz der ImapService-Klasse, die die Verbindung zum IMAP-Server handhabt
const imapService = new ImapService(imapConfig);
// Instanz der EmailProcessor-Klasse, die für die Verarbeitung und Filterung der E-Mails verantwortlich ist
const emailProcessor = new EmailProcessor();

// Funktion zum Abrufen und Aktualisieren der E-Mails
const updateEmails = async () => {
    try {
        // Verbindung zum IMAP-Server herstellen
        await imapService.connect();

        // Bestimmen des Datums vor drei Monaten für die E-Mail-Suche
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        // Abrufen der E-Mails vom IMAP-Server, die in den letzten drei Monaten empfangen wurden
        const fetchStream = await imapService.fetchEmails(threeMonthsAgo);

        // Verarbeitung jeder E-Mail-Nachricht
        fetchStream.on('message', (msg, seqno) => {
            emailProcessor.processMessage(msg, seqno); // Verarbeiten der Nachricht über EmailProcessor
        });

        // Sobald das Abrufen der E-Mails abgeschlossen ist
        fetchStream.once('end', () => {
            // Speichern der verarbeiteten E-Mails und Sortierung nach Datum
            storedEmails = emailProcessor.getEmails().sort((a, b) => b.date - a.date);
            console.log('E-Mails wurden aktualisiert und gespeichert');
            // Schließen der IMAP-Verbindung
            imapService.closeConnection();
        });
    } catch (err) {
        // Fehlerbehandlung für den Fall, dass beim Abrufen oder Verarbeiten der E-Mails ein Fehler auftritt
        console.error('Fehler beim Aktualisieren der E-Mails:', err);
    }
};

// Aufruf der Funktion, um die E-Mails beim Start des Servers zu aktualisieren
updateEmails();

// GET-Route zum Abrufen der E-Mails
app.get('/emails', (req, res) => {
    const { sortBy } = req.query; // Überprüfung, ob eine Sortierung angefordert wurde
    let sortedEmails = [...storedEmails]; // Kopieren der gespeicherten E-Mails

    // Falls die Sortierung nach Reservierungsdatum angefragt wurde
    if (sortBy === 'reservationDate') {
        sortedEmails.sort((a, b) => {
            const dateA = a.dateTime ? new Date(a.dateTime) : new Date(a.date);
            const dateB = b.dateTime ? new Date(b.dateTime) : new Date(b.date);
            return dateB - dateA; // Sortieren nach Reservierungsdatum
        });
    } else {
        // Standard-Sortierung nach E-Mail-Datum
        sortedEmails.sort((a, b) => b.date - a.date);
    }

    // Rückgabe der sortierten E-Mails als Antwort
    res.send(sortedEmails);
});

// POST-Route zum manuellen Aktualisieren der E-Mails
app.post('/refresh-emails', async (req, res) => {
    await updateEmails(); // Abrufen der neuen E-Mails
    res.send({ message: 'E-Mails wurden aktualisiert' }); // Senden einer Bestätigung
});

// Start des Servers, der auf dem angegebenen Port (Standard: 8080) läuft
app.listen(port, '0.0.0.0', () => {
    console.log(`Server läuft auf Port ${port}`);
});
