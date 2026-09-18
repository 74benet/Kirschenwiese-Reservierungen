import axios from 'axios';
import { backend_url } from './api';

export const isPushSupported = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/sw.js`).catch((err) => {
        console.error('Service Worker konnte nicht registriert werden:', err);
    });
};

// Der Schlüssel kommt als Base64-URL-Text, der Browser braucht Bytes
const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
};

const getSubscription = async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
};

// 'unsupported' | 'denied' | 'on' | 'off'
export const getPushState = async () => {
    if (!isPushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission !== 'granted') return 'off';
    const subscription = await getSubscription();
    if (!subscription) return 'off';
    // Anmeldung beim Server auffrischen (z. B. falls sie dort gelöscht wurde)
    axios.post(`${backend_url}/push/subscribe`, { subscription: subscription.toJSON(), test: false }).catch(() => {});
    return 'on';
};

// Muss direkt durch einen Tipp ausgelöst werden, sonst fragt iOS nicht nach der Erlaubnis
export const enablePush = async () => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

    const { data } = await axios.get(`${backend_url}/push/public-key`);
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
    // test: true -> der Server schickt direkt eine Bestätigung aufs Gerät
    await axios.post(`${backend_url}/push/subscribe`, { subscription: subscription.toJSON(), test: true });
    return 'on';
};

export const disablePush = async () => {
    const subscription = await getSubscription();
    if (subscription) {
        await axios.post(`${backend_url}/push/unsubscribe`, { endpoint: subscription.endpoint }).catch(() => {});
        await subscription.unsubscribe();
    }
    return 'off';
};
