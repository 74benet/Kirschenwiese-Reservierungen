import express from 'express';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());

let storedEmails = [];

const imapConfig = {
    user: process.env.REACT_APP_USER,
    password: process.env.REACT_APP_PASSWORD,
    host: process.env.REACT_APP_HOST,
    port: process.env.REACT_APP_PORT,
    tls: true,
    connTimeout: 30000,
    authTimeout: 30000,
    debug: console.log,
};

const parseDate = (dateString) => {
    const parsedDate = new Date(dateString);
    if (!isNaN(parsedDate)) {
        return parsedDate;
    }
    return null;
};

const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
};

const fetchEmails = () => {
    return new Promise((resolve, reject) => {
        const imap = new Imap(imapConfig);

        imap.once('ready', () => {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    return reject(err);
                }

                imap.search(['ALL', ['SINCE', threeMonthsAgo]], (err, results) => {
                    if (err) {
                        return reject(err);
                    }
                    if (results.length === 0) {
                        imap.end();
                        return resolve([]);
                    }
                    const fetch = imap.fetch(results, { bodies: '' });
                    const emails = [];

                    fetch.on('message', (msg, seqno) => {
                        msg.on('body', async (stream, info) => {
                            try {
                                const parsed = await simpleParser(stream);
                                const isOriginal = parsed.subject.includes('Neue Reservierungsanfrage') && !parsed.subject.startsWith('AW:');
                                const isReply = parsed.subject.startsWith('AW:');

                                if (isOriginal || isReply) {
                                    const text = parsed.text;
                                    const nameMatch = text.match(/Auf den Namen:\s*(.*)/);
                                    const personsMatch = text.match(/Für:\s*(\d+)\s*Personen/);
                                    const dateTimeMatch = text.match(/Am.\s*(.*)/);
                                    const userEmailMatch = text.match(/Von:\s*(.*)/);

                                    const name = nameMatch ? nameMatch[1] : 'Unbekannt';
                                    const persons = personsMatch ? personsMatch[1] : 'Unbekannt';
                                    const dateTime = dateTimeMatch ? parseDate(dateTimeMatch[1]) : null;
                                    const userEmail = userEmailMatch ? userEmailMatch[1] : 'Unbekannt';
                                    const date = parseDate(parsed.date) || new Date();

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
                                            hasReply: false,
                                        });
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
                                console.error('Fehler beim Parsen der Nachricht:', err);
                            }
                        });
                    });

                    fetch.once('error', (err) => {
                        reject(err);
                    });

                    fetch.once('end', () => {
                        emails.sort((a, b) => b.date - a.date);
                        imap.end();
                        resolve(emails);
                    });
                });
            });
        });

        imap.once('error', (err) => {
            reject(err);
        });

        imap.once('end', () => {
            console.log('Verbindung beendet');
        });

        imap.connect();
    });
};

const updateEmails = async () => {
    try {
        storedEmails = await fetchEmails();
        console.log('E-Mails wurden aktualisiert und gespeichert');
    } catch (err) {
        console.error('Fehler beim Aktualisieren der E-Mails:', err);
    }
};

updateEmails();

app.get('/emails', (req, res) => {
    const { sortBy } = req.query;
    let sortedEmails = [...storedEmails];

    if (sortBy === 'reservationDate') {
        sortedEmails.sort((a, b) => {
            const dateA = a.dateTime ? new Date(a.dateTime) : new Date(a.date);
            const dateB = b.dateTime ? new Date(b.dateTime) : new Date(b.date);
            return dateB - dateA;
        });
    } else {
        sortedEmails.sort((a, b) => b.date - a.date);
    }

    res.send(sortedEmails);
});

app.post('/refresh-emails', async (req, res) => {
    await updateEmails();
    res.send({ message: 'E-Mails wurden aktualisiert' });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server läuft auf Port ${port}`);
});
