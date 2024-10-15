// Importieren des Imap-Moduls, das für die Kommunikation mit IMAP-Servern zuständig ist
import Imap from 'imap';

// Definition der ImapService-Klasse, die die IMAP-Verbindung handhabt
export class ImapService {

    // Konstruktor der Klasse, der die Konfiguration für den IMAP-Server entgegennimmt
    constructor(config) {
        this.imapConfig = config;            // Speichern der IMAP-Konfiguration
        this.imap = new Imap(this.imapConfig); // Initialisieren des Imap-Objekts mit der Konfiguration
    }

    // Methode zum Herstellen der Verbindung zum IMAP-Server
    connect() {
        return new Promise((resolve, reject) => {
            // Ereignis: Sobald die Verbindung hergestellt ist, wird die Promise aufgelöst
            this.imap.once('ready', () => resolve());

            // Ereignis: Bei einem Fehler beim Verbindungsaufbau wird die Promise abgelehnt
            this.imap.once('error', (err) => reject(err));

            // Ereignis: Wenn die Verbindung geschlossen wird, wird dies im Log ausgegeben
            this.imap.once('end', () => console.log('IMAP Verbindung beendet'));

            // Verbindung zum IMAP-Server herstellen
            this.imap.connect();
        });
    }

    // Methode zum Abrufen von E-Mails, die nach einem bestimmten Datum empfangen wurden
    fetchEmails(threeMonthsAgo) {
        return new Promise((resolve, reject) => {
            // Öffnen der Mailbox (INBOX)
            this.imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    // Wenn ein Fehler beim Öffnen der Mailbox auftritt, wird die Promise abgelehnt
                    return reject(err);
                }

                // Suche nach allen E-Mails, die seit dem angegebenen Datum empfangen wurden
                this.imap.search(['ALL', ['SINCE', threeMonthsAgo]], (err, results) => {
                    if (err) {
                        // Fehlerbehandlung bei der Suche
                        return reject(err);
                    }
                    if (results.length === 0) {
                        // Wenn keine E-Mails gefunden werden, wird die Verbindung geschlossen und eine leere Liste zurückgegeben
                        this.imap.end();
                        return resolve([]);
                    }
                    // Abrufen der gefundenen E-Mails (basierend auf den Ergebnissen)
                    const fetch = this.imap.fetch(results, { bodies: '' });
                    resolve(fetch);  // Rückgabe des Fetch-Streams für weitere Verarbeitung
                });
            });
        });
    }

    // Methode zum Schließen der IMAP-Verbindung
    closeConnection() {
        this.imap.end();  // Beenden der Verbindung zum IMAP-Server
    }
}
