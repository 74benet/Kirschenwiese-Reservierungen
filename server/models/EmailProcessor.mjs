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
        return null;
    }

    for (const [germanMonth, englishMonth] of Object.entries(germanToEnglishMonths)) {
        dateString = dateString.replace(germanMonth, englishMonth);
    }

    const parsedDate = new Date(dateString);
    if (!isNaN(parsedDate)) {
        return parsedDate;
    }
    console.error('Ungültiges Datum nach dem Parsen:', dateString);
    return null;
};

const isOriginalSubject = (subject) => subject.includes('Neue Reservierungsanfrage') && !subject.startsWith('AW:');
const isReplySubject = (subject) => subject.startsWith('AW:');

// Wird schon beim Abruf der Betreffzeilen genutzt, damit nur relevante E-Mails vollständig geladen werden
export const isRelevantSubject = (subject) => isOriginalSubject(subject) || isReplySubject(subject);

// Liest aus einer geparsten E-Mail die Reservierungsdaten aus.
// Gibt null zurück, wenn es weder eine Reservierungsanfrage noch eine Antwort darauf ist.
export const parseReservation = (parsed) => {
    const subject = parsed.subject ?? '';
    const isOriginal = isOriginalSubject(subject);
    if (!isOriginal && !isReplySubject(subject)) return null;

    const text = parsed.text ?? '';

    // Extrahieren von Informationen aus dem E-Mail-Text mit regulären Ausdrücken
    const nameMatch = text.match(/Auf den Namen:\s*(.*)/);
    const personsMatch = text.match(/Für:\s*(\d+)\s*Personen/);
    const dateTimeMatch = text.match(/Am.\s*(.*)/);
    const userEmailMatch = text.match(/Von:\s*(.*)/);

    return {
        kind: isOriginal ? 'original' : 'reply',
        name: nameMatch ? nameMatch[1] : 'Unbekannt',
        persons: personsMatch ? personsMatch[1] : 'Unbekannt',
        dateTime: dateTimeMatch ? parseDate(dateTimeMatch[1]) : null, // Reservierungsdatum
        userEmail: userEmailMatch ? userEmailMatch[1] : 'Unbekannt',
        input: parsed.date || new Date(), // Eingangsdatum
        text,
    };
};

// Prüft, ob eine Antwort-Mail zu einer Reservierungsanfrage gehört
export const isReplyTo = (reply, original) =>
    reply.name === original.name &&
    reply.persons === original.persons &&
    reply.dateTime !== null && original.dateTime !== null &&
    reply.dateTime.getTime() === original.dateTime.getTime();

const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

// Wandelt die abgerufenen Nachrichten in Reservierungen (mit Antwort-Status) und Antworten um
export const processMessages = (messages) => {
    const items = messages
        .map(({ parsed }) => parseReservation(parsed))
        .filter(Boolean)
        .sort((a, b) => a.input - b.input); // älteste zuerst, damit bei Duplikaten die erste Anfrage zählt

    const replies = items.filter((item) => item.kind === 'reply');
    const seen = new Set();
    const reservations = [];

    for (const item of items) {
        if (item.kind !== 'original') continue;
        // Reservierungsdatum, falls vorhanden, sonst Eingangsdatum
        const date = item.dateTime || item.input;
        const key = `${item.userEmail}|${item.persons}|${dayKey(date)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        reservations.push({
            ...item,
            date,
            hasReply: replies.some((reply) => isReplyTo(reply, item)),
        });
    }

    return { reservations, replies };
};
