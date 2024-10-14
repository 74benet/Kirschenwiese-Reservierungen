import React from 'react';
import { CssBaseline } from '@mui/material';
import './App.css';
import EmailList from './EmailList';

function App() {
    return (
        <div className="background">
            <CssBaseline />
            <EmailList />
        </div>
    );
}

export default App;

//Google Kalender verbinden für benachrichtigungen und alles