// Importieren der simpleParser-Funktion aus dem mailparser-Modul
// Diese wird verwendet, um E-Mail-Nachrichten in ein lesbares Format zu konvertieren
import { simpleParser } from 'mailparser';

// Ein Objekt, das deutsche Monatsnamen in englische Monatsnamen umwandelt
// Dies wird benötigt, da die Date-Objekte von JavaScript englische Monatsnamen erwarten
const germanToEnglishMonths = {
    'Januar': 'January',
    'Februar': 'February',
    'März': 'March',
    'April': 'April',
    'Mai': 'May',
    'Juni': 'June',
    'Juli': 'July',
    'August': 'August',
    'September': 'September',
    'Oktober': 'October',
    'November': 'November',
    'Dezember': 'December',
};

// Hilfsfunktion, die ein Datum als String (in deutscher Sprache) in ein JavaScript-Datum konvertiert
// Deutsche Monatsnamen werden durch ihre englischen Entsprechungen ersetzt
const parseDate = (dateString) => {
    if (typeof dateString !== 'string') {
        console.error('Ungültiger dateString:', dateString);
        return null;
    }

    // Ersetzen der deutschen Monatsnamen im String durch englische
    Object.keys(germanToEnglishMonths).forEach((germanMonth) => {
        const englishMonth = germanToEnglishMonths[germanMonth];
        dateString = dateString.replace(germanMonth, englishMonth);
    });

    // Konvertieren des Strings in ein Date-Objekt
    const parsedDate = new Date(dateString);
    if (!isNaN(parsedDate)) {
        return parsedDate; // Gültiges Datum zurückgeben
    }
    console.error('Ungültiges Datum nach dem Parsen:', dateString);
    return null;
};

// Hilfsfunktion zum Formatieren eines Datums in das Format "dd.mm.yyyy hh:mm"
const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Monat von 0-basiert zu 1-basiert
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
};

// Definition der EmailProcessor-Klasse, die die Verarbeitung von E-Mails übernimmt
export class EmailProcessor {
    constructor() {
        this.emails = []; // Initialisiert ein leeres Array, um die verarbeiteten E-Mails zu speichern
    }

    // Methode zum Verarbeiten einer einzelnen E-Mail-Nachricht
    // msg: die E-Mail-Nachricht
    // seqno: die Sequenznummer der E-Mail
    async processMessage(msg, seqno) {
        const emails = this.emails; // Referenz auf das lokale E-Mail-Array

        // Hören auf den Body-Stream der E-Mail
        msg.on('body', async (stream, info) => {
            try {
                // Verwenden des simpleParser zum Parsen des E-Mail-Streams
                const parsed = await simpleParser(stream);

                // Überprüfen, ob die E-Mail eine neue Reservierungsanfrage oder eine Antwort darauf ist
                const isOriginal = parsed.subject.includes('Neue Reservierungsanfrage') && !parsed.subject.startsWith('AW:');
                const isReply = parsed.subject.startsWith('AW:');

                if (isOriginal || isReply) {
                    const text = parsed.text; // Der Textinhalt der E-Mail

                    // Extrahieren von Informationen aus dem E-Mail-Text mit regulären Ausdrücken
                    const nameMatch = text.match(/Auf den Namen:\s*(.*)/);
                    const personsMatch = text.match(/Für:\s*(\d+)\s*Personen/);
                    const dateTimeMatch = text.match(/Am.\s*(.*)/);
                    const userEmailMatch = text.match(/Von:\s*(.*)/);

                    const name = nameMatch ? nameMatch[1] : 'Unbekannt'; // Extrahierter Name oder 'Unbekannt'
                    const persons = personsMatch ? personsMatch[1] : 'Unbekannt'; // Anzahl der Personen oder 'Unbekannt'
                    const dateTime = dateTimeMatch ? parseDate(dateTimeMatch[1]) : null; // Datum der Reservierung
                    const userEmail = userEmailMatch ? userEmailMatch[1] : 'Unbekannt'; // E-Mail-Adresse des Benutzers
                    const date = parsed.date || new Date(); // Datum der E-Mail oder aktuelles Datum

                    // Wenn es eine neue Reservierungsanfrage ist, füge sie der Liste der E-Mails hinzu
                    if (isOriginal) {
                        emails.push({
                            id: seqno,
                            subject: parsed.subject,
                            from: parsed.from.text,
                            date,
                            formattedDate: formatDate(date),
                            name,
                            persons,
                            dateTime,
                            formattedDateTime: dateTime ? formatDate(dateTime) : 'N/A',
                            userEmail,
                            text: parsed.text,
                            hasReply: false, // Standardmäßig keine Antwort vorhanden
                        });
                        // Wenn es eine Antwort auf eine Reservierungsanfrage ist, markiere die Original-E-Mail als beantwortet
                    } else if (isReply) {
                        const originalEmail = emails.find(email =>
                            email.subject.includes('Neue Reservierungsanfrage') &&
                            email.name === name &&
                            email.persons === persons &&
                            email.dateTime && dateTime && email.dateTime.getTime() === dateTime.getTime()
                        );
                        if (originalEmail) {
                            originalEmail.hasReply = true;
                        }
                        // Verarbeitung anderer E-Mails, die keine Reservierungsanfragen sind
                    } else {
                        emails.push({
                            id: seqno,
                            subject: parsed.subject,
                            from: parsed.from.text,
                            date,
                            formattedDate: formatDate(date),
                            text: parsed.text,
                            userEmail,
                            name: parsed.from.text,
                            persons: 'N/A',
                            dateTime: null,
                            formattedDateTime: 'N/A',
                            hasReply: false,
                        });
                    }
                }
            } catch (err) {
                // Fehlerbehandlung für den Fall, dass beim Parsen der Nachricht ein Fehler auftritt
                console.error('Fehler beim Parsen der Nachricht:', err);
            }
        });
    }

    // Methode zum Abrufen der verarbeiteten E-Mails
    getEmails() {
        return this.emails;
    }
}
