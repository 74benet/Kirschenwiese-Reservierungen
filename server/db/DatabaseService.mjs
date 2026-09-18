import pkg from 'pg';
const { Pool } = pkg;

// Erlaubte Sortierungen (Whitelist, da Spaltennamen nicht als Parameter übergeben werden können)
const SORT_COLUMNS = { input: 'input', date: 'date' };

export class EmailDatabaseService {
    constructor() {
        // Ein gemeinsamer Pool für die gesamte Anwendung
        this.pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
            // Gehostete Datenbanken wie Supabase verlangen eine verschlüsselte Verbindung
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        });
        this.pool.on('error', (err) => console.error('Unerwarteter Datenbankfehler:', err.message));
    }

    // Legt die Tabelle an, falls sie noch nicht existiert (z. B. bei einer frischen Docker-Datenbank)
    async ensureSchema() {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS emails (
                id SERIAL PRIMARY KEY,
                name TEXT,
                persons TEXT,
                email TEXT,
                date TIMESTAMPTZ,
                text TEXT,
                status BOOLEAN DEFAULT FALSE,
                input TIMESTAMPTZ
            );
        `);
        // Geräte, die Push-Benachrichtigungen bekommen. RLS an und ohne Regeln: nur der Server
        // (Datenbank-Benutzer) kommt ran, nicht die öffentliche Supabase-API.
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                endpoint TEXT PRIMARY KEY,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        await this.pool.query(`ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;`);
    }

    // Ohne den kompletten E-Mail-Text, damit die Liste klein bleibt (Text gibt es über getEmailText)
    async listEmails(sortBy) {
        const column = SORT_COLUMNS[sortBy] ?? SORT_COLUMNS.input;
        const result = await this.pool.query(`
            SELECT id, name, persons, email, date, status, input
            FROM emails
            ORDER BY ${column} DESC NULLS LAST, id DESC;
        `);
        return result.rows;
    }

    // Speichert neue Reservierungen. Bereits vorhandene (gleiche E-Mail, gleicher Tag, gleiche Personenzahl)
    // werden übersprungen. Gibt die neu gespeicherten Reservierungen zurück.
    async saveReservations(reservations) {
        if (reservations.length === 0) return [];
        const client = await this.pool.connect();
        const added = [];
        try {
            for (const reservation of reservations) {
                try {
                    const exists = await client.query(
                        `SELECT 1 FROM emails WHERE email = $1 AND DATE(date) = DATE($2) AND persons = $3 LIMIT 1;`,
                        [reservation.userEmail, reservation.date, reservation.persons]
                    );
                    if (exists.rowCount > 0) continue;

                    await client.query(
                        `INSERT INTO emails (name, persons, email, date, text, status, input)
                         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
                        [
                            reservation.name,
                            reservation.persons,
                            reservation.userEmail,
                            reservation.date,      // Reservierungsdatum
                            reservation.text,
                            reservation.hasReply,  // Status, ob die E-Mail beantwortet wurde
                            reservation.input,     // Eingangsdatum
                        ]
                    );
                    added.push(reservation);
                    console.log(`Neue Reservierung gespeichert: ${reservation.name} (${reservation.persons} Personen)`);
                } catch (err) {
                    // Ein fehlerhafter Datensatz soll den restlichen Abgleich nicht blockieren
                    console.error('Fehler beim Speichern der E-Mail:', reservation.userEmail, err.message);
                }
            }
        } finally {
            client.release();
        }
        return added;
    }

    // Markiert Reservierungen als erledigt, auf die per E-Mail geantwortet wurde
    async markAnswered(replies) {
        let updated = 0;
        for (const reply of replies) {
            if (!reply.dateTime) continue;
            try {
                const result = await this.pool.query(
                    `UPDATE emails SET status = TRUE
                     WHERE name = $1 AND persons = $2 AND date = $3 AND status IS NOT TRUE;`,
                    [reply.name, reply.persons, reply.dateTime]
                );
                updated += result.rowCount;
            } catch (err) {
                console.error('Fehler beim Markieren der Antwort:', err.message);
            }
        }
        return updated;
    }

    // Reservierungen für das Kalender-Abo (ab einem Datum, nur mit Reservierungsdatum)
    async listCalendarReservations(from) {
        const result = await this.pool.query(
            `SELECT id, name, persons, email, date, status, input
             FROM emails
             WHERE date >= $1
             ORDER BY date;`,
            [from]
        );
        return result.rows;
    }

    async savePushSubscription({ endpoint, keys }) {
        await this.pool.query(
            `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ($1, $2, $3)
             ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth;`,
            [endpoint, keys.p256dh, keys.auth]
        );
    }

    async deletePushSubscription(endpoint) {
        await this.pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1;`, [endpoint]);
    }

    async listPushSubscriptions() {
        const result = await this.pool.query(`SELECT endpoint, p256dh, auth FROM push_subscriptions;`);
        return result.rows;
    }

    async getEmailText(id) {
        const result = await this.pool.query(`SELECT text FROM emails WHERE id = $1;`, [id]);
        return result.rows[0]?.text ?? null;
    }

    async setStatus(id, status) {
        const result = await this.pool.query(
            `UPDATE emails SET status = $2 WHERE id = $1 RETURNING id, name, persons, email, date, status, input;`,
            [id, status]
        );
        return result.rows[0] ?? null;
    }

    closeConnection() {
        return this.pool.end();
    }
}
