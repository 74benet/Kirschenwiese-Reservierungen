import React, { useEffect, useState } from 'react';
import { CssBaseline } from '@mui/material';
import './App.css';
import EmailList from './EmailList';
import Login from './Login';
import { loadPassword, onUnauthorized, savePassword, setAuthHeader } from './api';

function App() {
    const [password, setPassword] = useState(loadPassword);
    // Direkt beim Rendern setzen, damit schon die erste Anfrage der Liste das Passwort mitschickt
    setAuthHeader(password);

    useEffect(() => {
        // Passwort falsch oder geändert: gemerktes Passwort löschen und Anmeldung zeigen
        onUnauthorized(() => {
            savePassword('');
            setPassword('');
        });
    }, []);

    const handleLogin = (newPassword) => {
        savePassword(newPassword);
        setPassword(newPassword);
    };

    return (
        <div className="background">
            <CssBaseline />
            {password ? <EmailList /> : <Login onLogin={handleLogin} />}
        </div>
    );
}

export default App;

//Google Kalender verbinden für benachrichtigungen und alles
