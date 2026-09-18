import axios from 'axios';

// Leer = gleicher Server wie das Frontend (so läuft es auf Cloud Run)
export const backend_url = process.env.REACT_APP_BACKEND_URL || '';

const STORAGE_KEY = 'kirschenwiese-password';

// Das Passwort wird auf dem Gerät gemerkt, damit man es nicht jedes Mal eingeben muss
export const loadPassword = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
        return '';
    }
};

export const savePassword = (password) => {
    try {
        if (password) localStorage.setItem(STORAGE_KEY, password);
        else localStorage.removeItem(STORAGE_KEY);
    } catch {
        // z. B. privater Modus: dann gilt das Passwort nur bis zum Schließen der Seite
    }
};

export const setAuthHeader = (password) => {
    axios.defaults.headers.common['X-App-Password'] = password;
};

// Bei "Falsches Passwort" vom Server zurück zur Anmeldung
let unauthorizedHandler = () => {};
export const onUnauthorized = (handler) => {
    unauthorizedHandler = handler;
};
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) unauthorizedHandler();
        return Promise.reject(error);
    }
);

// Prüft ein Passwort beim Server. Gibt true/false zurück, wirft bei Verbindungsproblemen.
export const checkPassword = async (password) => {
    try {
        await axios.get(`${backend_url}/auth-check`, { headers: { 'X-App-Password': password } });
        return true;
    } catch (err) {
        if (err.response?.status === 401) return false;
        throw err;
    }
};
