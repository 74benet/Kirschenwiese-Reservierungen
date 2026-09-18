import React, { useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import { checkPassword } from './api';

const Login = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!password || checking) return;
        setChecking(true);
        setError(null);
        try {
            if (await checkPassword(password)) {
                onLogin(password);
                return;
            }
            setError('Falsches Passwort.');
        } catch {
            setError('Server nicht erreichbar. Bitte später erneut versuchen.');
        }
        setChecking(false);
    };

    return (
        <Box display="flex" flexDirection="column" alignItems="center" width="100%" px={2}>
            <img
                src={`${process.env.PUBLIC_URL}/logo-shadow.png`}
                alt="Logo"
                style={{ height: '200px', width: 'auto' }}
            />
            <Paper
                component="form"
                onSubmit={handleSubmit}
                elevation={3}
                sx={{ p: 3, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 2 }}
            >
                <Typography variant="h6" style={{ fontWeight: 'bold', color: '#B23C3CE5' }}>
                    Reservierungen
                </Typography>
                <TextField
                    type="password"
                    label="Passwort"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoFocus
                    autoComplete="current-password"
                    fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { color: '#333' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#ccc' } }}
                />
                {error && <Alert severity="error">{error}</Alert>}
                <Button
                    type="submit"
                    variant="contained"
                    disabled={!password || checking}
                    style={{ minHeight: '45px', backgroundColor: '#B23C3C', color: 'white', fontWeight: 'bold' }}
                >
                    {checking ? <CircularProgress size={24} style={{ color: 'white' }} /> : 'Anmelden'}
                </Button>
            </Paper>
        </Box>
    );
};

export default Login;
