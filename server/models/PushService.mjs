import webpush from 'web-push';

// Nur Reservierungen melden, die höchstens so alt sind (verhindert eine Flut alter Meldungen)
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Ab so vielen neuen Reservierungen gibt es eine Sammelmeldung statt einzelner
const MAX_SINGLE_NOTIFICATIONS = 3;

const formatDate = (date) => new Date(date).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
});

// Verschickt Push-Benachrichtigungen an alle angemeldeten Geräte (z. B. die Web-App auf dem iPhone)
export class PushService {
    constructor(db, { publicKey, privateKey, subject }) {
        this.db = db;
        this.publicKey = publicKey;
        this.enabled = Boolean(publicKey && privateKey);
        if (this.enabled) {
            webpush.setVapidDetails(subject, publicKey, privateKey);
        } else {
            console.warn('Push-Benachrichtigungen sind aus (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY fehlen).');
        }
    }

    async send(subscription, payload) {
        try {
            await webpush.sendNotification(
                { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
                JSON.stringify(payload),
                { TTL: 60 * 60 }
            );
        } catch (err) {
            // Gerät hat die Benachrichtigungen abbestellt oder die App gelöscht
            if (err.statusCode === 404 || err.statusCode === 410) {
                await this.db.deletePushSubscription(subscription.endpoint);
            } else {
                console.error('Push konnte nicht gesendet werden:', err.statusCode ?? '', err.body || err.message);
            }
        }
    }

    async sendToAll(payload) {
        if (!this.enabled) return;
        const subscriptions = await this.db.listPushSubscriptions();
        await Promise.all(subscriptions.map((subscription) => this.send(subscription, payload)));
    }

    async notifyNewReservations(reservations) {
        const recent = reservations.filter((r) => Date.now() - new Date(r.input).getTime() < MAX_AGE_MS);
        if (!this.enabled || recent.length === 0) return;

        if (recent.length > MAX_SINGLE_NOTIFICATIONS) {
            await this.sendToAll({
                title: `🍕 ${recent.length} neue Reservierungen`,
                body: recent.map((r) => `${r.name} (${r.persons} Pers.)`).join(', '),
                tag: 'reservierungen',
            });
            return;
        }

        for (const reservation of recent) {
            await this.sendToAll({
                title: '🍕 Neue Reservierung',
                body: `${reservation.name}, ${reservation.persons} Pers. – ${formatDate(reservation.date)}`,
            });
        }
    }
}
