// Importieren des Imap-Moduls, das für die Kommunikation mit IMAP-Servern zuständig ist
import Imap from 'imap';
import { simpleParser } from 'mailparser';

// Definition der ImapService-Klasse, die die IMAP-Verbindung handhabt.
// Pro Abruf wird eine frische Verbindung aufgebaut und danach wieder geschlossen,
// so können sich keine Event-Listener oder kaputte Verbindungen zwischen zwei Abrufen ansammeln.
export class ImapService {
    constructor(config) {
        this.imapConfig = config;
    }

    // Ruft alle relevanten E-Mails ab und gibt sie fertig geparst zurück.
    // - Ohne afterUid (erster Abruf): alle E-Mails seit `since`
    // - Mit afterUid (Folgeabrufe): nur E-Mails, die seitdem neu eingegangen sind (UID > afterUid)
    // Zuerst werden nur die Betreffzeilen geladen und gefiltert, erst danach die vollständigen
    // Nachrichten der relevanten E-Mails. Das spart den Großteil der Übertragung.
    async fetchMessages({ since, afterUid = 0, uidValidity = null, isRelevantSubject }) {
        const imap = new Imap(this.imapConfig);
        await connect(imap);
        // Fehler nach dem Verbindungsaufbau dürfen den Prozess nicht zum Absturz bringen
        imap.on('error', (err) => console.error('IMAP-Fehler:', err.message));

        try {
            const box = await openBox(imap, 'INBOX');
            const currentUidValidity = box.uidvalidity;
            // Hat sich die UIDVALIDITY geändert, sind die gespeicherten UIDs ungültig -> kompletter Abruf
            const incremental = afterUid > 0 && uidValidity === currentUidValidity;

            let uids = await search(imap, incremental ? [['UID', `${afterUid + 1}:*`]] : [['SINCE', since]]);
            // "N:*" liefert laut IMAP-Standard immer mindestens die letzte Nachricht, auch wenn deren UID < N ist
            if (incremental) uids = uids.filter((uid) => uid > afterUid);

            const maxUid = uids.reduce((max, uid) => Math.max(max, uid), incremental ? afterUid : 0);
            const result = { uidValidity: currentUidValidity, maxUid, incremental, messages: [] };
            if (uids.length === 0) return result;

            // Schritt 1: nur Betreffzeilen laden (sehr klein) und filtern
            const headers = await fetchAll(imap, uids, { bodies: 'HEADER.FIELDS (SUBJECT)' });
            const relevantUids = headers
                .filter(({ buffer }) => {
                    const subject = Imap.parseHeader(buffer.toString('utf8')).subject?.[0] ?? '';
                    return isRelevantSubject(subject);
                })
                .map(({ uid }) => uid);
            if (relevantUids.length === 0) return result;

            // Schritt 2: nur die relevanten Nachrichten vollständig laden und parallel parsen
            const bodies = await fetchAll(imap, relevantUids, { bodies: '' });
            result.messages = await Promise.all(
                bodies.map(async ({ uid, buffer }) => ({ uid, parsed: await simpleParser(buffer) }))
            );
            return result;
        } finally {
            imap.end();
        }
    }
}

function connect(imap) {
    return new Promise((resolve, reject) => {
        const onError = (err) => {
            imap.removeListener('ready', onReady);
            reject(err);
        };
        const onReady = () => {
            imap.removeListener('error', onError);
            resolve();
        };
        imap.once('ready', onReady);
        imap.once('error', onError);
        imap.connect();
    });
}

function openBox(imap, name) {
    return new Promise((resolve, reject) => {
        // readOnly = true: der Abruf verändert nichts im Postfach
        imap.openBox(name, true, (err, box) => (err ? reject(err) : resolve(box)));
    });
}

function search(imap, criteria) {
    return new Promise((resolve, reject) => {
        imap.search(criteria, (err, uids) => (err ? reject(err) : resolve(uids)));
    });
}

// Lädt die angegebenen Nachrichten und wartet, bis wirklich alle Inhalte vollständig empfangen wurden
function fetchAll(imap, uids, options) {
    return new Promise((resolve, reject) => {
        const pending = [];
        const fetch = imap.fetch(uids, options);

        fetch.on('message', (msg) => {
            pending.push(new Promise((resolveMsg) => {
                const chunks = [];
                let uid;
                let hasBody = false;
                let bodyDone = false;
                let msgDone = false;
                const finish = () => {
                    if (bodyDone && msgDone) resolveMsg({ uid, buffer: Buffer.concat(chunks) });
                };

                msg.on('body', (stream) => {
                    hasBody = true;
                    stream.on('data', (chunk) => chunks.push(chunk));
                    stream.once('end', () => { bodyDone = true; finish(); });
                });
                msg.once('attributes', (attrs) => { uid = attrs.uid; });
                msg.once('end', () => {
                    msgDone = true;
                    if (!hasBody) bodyDone = true; // Nachricht ohne Inhalt: nicht ewig warten
                    finish();
                });
            }));
        });

        fetch.once('error', reject);
        fetch.once('end', () => Promise.all(pending).then(resolve, reject));
    });
}
