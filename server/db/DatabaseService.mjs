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
    }

    async listEmails(sortBy) {
        const column = SORT_COLUMNS[sortBy] ?? SORT_COLUMNS.input;
        const result = await this.pool.query(`
            SELECT id, name, persons, email, date, text, status, input
            FROM emails
            ORDER BY ${column} DESC, id DESC;
        `);
        return result.rows;
    }

    // Speichert neue Reservierungen. Bereits vorhandene (gleiche E-Mail, gleicher Tag, gleiche Personenzahl)
    // werden übersprungen. Gibt die Anzahl der neu gespeicherten Einträge zurück.
    async saveReservations(reservations) {
        if (reservations.length === 0) return 0;
        const client = await this.pool.connect();
        let added = 0;
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
                    added++;
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

    async setStatus(id, status) {
        const result = await this.pool.query(
            `UPDATE emails SET status = $2 WHERE id = $1 RETURNING id, name, persons, email, date, text, status, input;`,
            [id, status]
        );
        return result.rows[0] ?? null;
    }

    closeConnection() {
        return this.pool.end();
    }
}
