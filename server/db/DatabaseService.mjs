import pkg from 'pg';
const { Pool } = pkg;

export class EmailDatabaseService {
    constructor() {
        // Initialisiere den Pool für die Verbindung zur PostgreSQL-Datenbank
        this.pool = new Pool({
            user: process.env.DB_USER,       // Benutzername für die Datenbank
            host: process.env.DB_HOST,       // Host-Adresse der Datenbank
            database: process.env.DB_NAME,   // Datenbankname
            password: process.env.DB_PASSWORD, // Passwort für die Datenbank
            port: process.env.DB_PORT,       // Port der Datenbank (Standard: 5432)
        });
    }

    // Methode zum Speichern von E-Mails in die Datenbank
    async saveEmail(email) {
        const client = await this.pool.connect();
        try {
            // Überprüfen, ob die E-Mail bereits in der Datenbank vorhanden ist
            const checkQuery = `
            SELECT * FROM emails
            WHERE email = $1 AND DATE(date) = DATE($2) AND persons = $3;
        `;

            const checkResult = await client.query(checkQuery, [email.userEmail, email.dateTime, email.persons]);

            // Wenn die E-Mail noch nicht existiert, füge sie in die Datenbank ein
            if (checkResult.rows.length === 0) {
                const insertQuery = `
                INSERT INTO emails (name, persons, email, date, text, status, input)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *;
            `;
                const values = [
                    email.name,
                    email.persons,
                    email.userEmail,
                    email.dateTime,   // Reservierungsdatum
                    email.text,
                    email.hasReply,   // Status, ob die E-Mail beantwortet wurde
                    email.date        // Eingangsdatum als 'input'
                ];
                const insertResult = await client.query(insertQuery, values);
                console.log('Neue E-Mail wurde gespeichert:', insertResult.rows[0]);
            } else {
                console.log('E-Mail bereits in der Datenbank vorhanden:', email.userEmail);
            }
        } catch (err) {
            console.error('Fehler beim Speichern der E-Mail:', err);
        } finally {
            client.release(); // Verbindung freigeben
        }
    }

    // Methode zum Schließen der Datenbankverbindung
    closeConnection() {
        this.pool.end();
    }
}
