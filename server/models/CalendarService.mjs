// Erzeugt eine Kalenderdatei (iCalendar/ICS) für ein Kalender-Abo, z. B. auf dem iPhone

const EVENT_DURATION_MS = 2 * 60 * 60 * 1000; // Reservierungen werden als 2-Stunden-Termin eingetragen

// Datum im Format 20260920T170000Z (UTC)
const formatUtc = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const formatLocal = (date) => new Date(date).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

// Sonderzeichen nach RFC 5545 maskieren
const escapeText = (value) => String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// Zeilen dürfen höchstens 75 Bytes lang sein, längere werden umgebrochen (Folgezeile beginnt mit Leerzeichen)
const foldLine = (line) => {
    const parts = [];
    let current = '';
    let currentBytes = 0;
    for (const char of line) {
        const bytes = Buffer.byteLength(char);
        const limit = parts.length === 0 ? 75 : 74;
        if (currentBytes + bytes > limit) {
            parts.push(current);
            current = '';
            currentBytes = 0;
        }
        current += char;
        currentBytes += bytes;
    }
    parts.push(current);
    return parts.join('\r\n ');
};

export const buildCalendar = (reservations) => {
    const now = formatUtc(new Date());
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Pizzeria Kirschenwiese//Reservierungen//DE',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Kirschenwiese Reservierungen',
        'X-WR-TIMEZONE:Europe/Berlin',
        // Hinweis an Kalender-Apps, alle 15 Minuten neu zu laden
        'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
        'X-PUBLISHED-TTL:PT15M',
    ];

    for (const reservation of reservations) {
        const start = new Date(reservation.date);
        const end = new Date(start.getTime() + EVENT_DURATION_MS);
        const icon = reservation.status ? '✅' : '🍕';
        const description = [
            `Name: ${reservation.name}`,
            `Personen: ${reservation.persons}`,
            `E-Mail: ${reservation.email}`,
            `Eingegangen: ${reservation.input ? formatLocal(reservation.input) : 'unbekannt'}`,
            `Status: ${reservation.status ? 'erledigt' : 'offen'}`,
        ].join('\n');

        lines.push(
            'BEGIN:VEVENT',
            // Feste ID pro Reservierung, damit Änderungen den bestehenden Termin aktualisieren
            `UID:reservierung-${reservation.id}@pizzeria-kirschenwiese.de`,
            `DTSTAMP:${now}`,
            `DTSTART:${formatUtc(start)}`,
            `DTEND:${formatUtc(end)}`,
            `SUMMARY:${escapeText(`${icon} ${reservation.name} – ${reservation.persons} Pers.`)}`,
            `DESCRIPTION:${escapeText(description)}`,
            'TRANSP:OPAQUE',
            'END:VEVENT'
        );
    }

    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
};
