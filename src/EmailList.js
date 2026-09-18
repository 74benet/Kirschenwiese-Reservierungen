import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
    Container,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    CircularProgress,
    Grid,
    Box,
    Paper,
    useTheme,
    IconButton,
    Fade,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    FormControl,
    Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import {Reorder, Visibility} from "@mui/icons-material";
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { backend_url } from './api';
import { disablePush, enablePush, getPushState } from './push';

const customTheme = createTheme({
    components: {
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'white', // Weißer Rand im Idle-Zustand
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#FFCC00', // Optional: anderer Hover-Farbton
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#fef3e3', // Beim Fokus
                    },
                    color: '#fef3e3',
                },
            },
        },
    },
});

// Wie oft die Liste automatisch aus der Datenbank nachgeladen wird (der Server holt selbst regelmäßig neue E-Mails)
const AUTO_RELOAD_MS = 30_000;
const EMAILS_PER_PAGE = 30;

// Gemeinsamer Stil für die runden weißen Buttons oben
const headerButtonSx = {
    backgroundColor: 'white',
    color: '#333',
    marginRight: '10px',
    transition: 'all 0.3s ease-in-out',
    '&:hover': {
        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.5)',
        transform: 'translateY(-2px)',
        color: 'rgba(255, 235, 0, 0.8)',
        backgroundColor: 'rgba(255, 255, 255, 1)',
    },
    '&.Mui-disabled': {
        backgroundColor: 'white',
    },
};

const EmailList = () => {
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [info, setInfo] = useState(null);
    const [pushState, setPushState] = useState('off');
    const [pushBusy, setPushBusy] = useState(false);
    const [calendarUrl, setCalendarUrl] = useState(null);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [sortBy, setSortBy] = useState('input');
    // Nur einen Teil der Liste anzeigen, alle Einträge auf einmal machen die Seite (v. a. am Handy) langsam
    const [visibleCount, setVisibleCount] = useState(EMAILS_PER_PAGE);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    // Verhindert, dass eine ältere, langsamere Antwort eine neuere überschreibt
    const requestIdRef = useRef(0);

    const fetchEmails = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        try {
            const response = await axios.get(`${backend_url}/emails`, { params: { sortBy } });
            if (requestId === requestIdRef.current) {
                setEmails(response.data);
                setError(null);
            }
        } catch (err) {
            console.error('Error fetching emails:', err);
            if (requestId === requestIdRef.current) setError('Reservierungen konnten nicht geladen werden.');
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [sortBy]);

    useEffect(() => {
        fetchEmails();
    }, [fetchEmails]);

    // Automatisch nachladen: regelmäßig und sobald die App wieder in den Vordergrund kommt
    useEffect(() => {
        const reloadIfVisible = () => {
            if (document.visibilityState === 'visible') fetchEmails();
        };
        const interval = setInterval(reloadIfVisible, AUTO_RELOAD_MS);
        document.addEventListener('visibilitychange', reloadIfVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', reloadIfVisible);
        };
    }, [fetchEmails]);

    useEffect(() => {
        getPushState().then(setPushState).catch(() => setPushState('off'));
    }, []);

    const handleTogglePush = async () => {
        if (pushState === 'unsupported') {
            setInfo('Benachrichtigungen gehen auf dem iPhone nur, wenn die Seite über „Teilen → Zum Home-Bildschirm“ als App hinzugefügt wurde (ab iOS 16.4). Öffne sie dann über das App-Symbol.');
            return;
        }
        if (pushState === 'denied') {
            setInfo('Benachrichtigungen sind blockiert. Erlaube sie in den iPhone-Einstellungen unter „Mitteilungen“ für diese App.');
            return;
        }
        setPushBusy(true);
        try {
            if (pushState === 'on') {
                setPushState(await disablePush());
                setInfo('Benachrichtigungen auf diesem Gerät ausgeschaltet.');
            } else {
                const state = await enablePush();
                setPushState(state);
                if (state === 'on') setInfo('Benachrichtigungen aktiv. Du solltest gleich eine Test-Benachrichtigung bekommen.');
            }
        } catch (err) {
            console.error('Fehler bei den Benachrichtigungen:', err);
            setError('Benachrichtigungen konnten nicht eingerichtet werden.');
        }
        setPushBusy(false);
    };

    const handleOpenCalendar = async () => {
        try {
            const { data } = await axios.get(`${backend_url}/calendar-url`);
            setCalendarUrl(data.url);
        } catch (err) {
            console.error('Fehler beim Laden der Kalender-Adresse:', err);
            setError('Kalender-Adresse konnte nicht geladen werden.');
        }
    };

    const handleCopyCalendarUrl = async () => {
        try {
            await navigator.clipboard.writeText(calendarUrl);
            setInfo('Kalender-Adresse kopiert.');
        } catch {
            setInfo('Kopieren nicht möglich – bitte die Adresse im Fenster markieren und kopieren.');
        }
    };

    const handleSortChange = (event) => {
        setLoading(true);
        setSortBy(event.target.value);
        setVisibleCount(EMAILS_PER_PAGE);
    };

    // Holt zuerst neue E-Mails vom Mailserver (das Backend antwortet erst, wenn alles gespeichert ist)
    // und lädt danach die Liste neu
    const handleUpdateEmails = async () => {
        if (refreshing) return;
        setRefreshing(true);
        let refreshFailed = false;
        try {
            await axios.post(`${backend_url}/refresh-emails`);
        } catch (err) {
            console.error('Error refreshing emails:', err);
            refreshFailed = true;
        }
        await fetchEmails();
        if (refreshFailed) setError('Neue E-Mails konnten nicht vom Mailserver abgerufen werden.');
        setRefreshing(false);
    };

    const generateMailtoLink = (email, subjectPrefix, body) => {
        return `mailto:${email.email}?subject=${encodeURIComponent(subjectPrefix + 'Reservierung Pizzeria Kirschenwiese')}&body=${encodeURIComponent(body)}`;
    };

    const formatDate = (date) => {
        if (!date) return 'Kein Datum';
        return new Date(date).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Der komplette Text wird erst beim Öffnen geladen, damit die Liste klein und schnell bleibt
    const handleViewFullEmail = async (email) => {
        setSelectedEmail({ ...email, text: null });
        try {
            const response = await axios.get(`${backend_url}/emails/${email.id}/text`);
            setSelectedEmail(current => (current?.id === email.id ? { ...current, text: response.data.text } : current));
        } catch (err) {
            console.error('Fehler beim Laden der Nachricht:', err);
            setSelectedEmail(current => (current?.id === email.id ? { ...current, text: 'Nachricht konnte nicht geladen werden.' } : current));
        }
    };

    const handleCloseDialog = () => {
        setSelectedEmail(null);
    };

    // status = true: erledigt (angenommen oder abgelehnt), false: ungelesen
    const handleStatusUpdate = async (email, status) => {
        const previousStatus = email.status;
        // Sofort in der Oberfläche anzeigen, bei einem Fehler wieder zurücksetzen
        setEmails(current => current.map(e => (e.id === email.id ? { ...e, status } : e)));
        try {
            await axios.post(`${backend_url}/emails/${email.id}/status`, { status });
        } catch (err) {
            console.error('Fehler beim Aktualisieren des Status:', err);
            setEmails(current => current.map(e => (e.id === email.id ? { ...e, status: previousStatus } : e)));
            setError('Status konnte nicht gespeichert werden.');
        }
    };

    return (
        <ThemeProvider theme={customTheme}>
            <Box display="flex" flexDirection="column" alignItems="center" width={isMobile ? '100%' : '50%'}>
                <img
                    src={`${process.env.PUBLIC_URL}/logo-shadow.png`}
                    alt="Logo"
                    style={{ height: '200px', width: 'auto', cursor: 'pointer' }}
                    onClick={handleUpdateEmails}
                />
                <Box display="flex" justifyContent="center" alignItems="center" mb={2} width={isMobile ? '90%' : '92%'}>
                    <IconButton
                        variant="contained"
                        color="primary"
                        onClick={handleUpdateEmails}
                        disabled={refreshing}
                        aria-label="Neue Reservierungen abrufen"
                        sx={headerButtonSx}
                    >
                        {refreshing ? (
                            <CircularProgress size={35} thickness={5} style={{ color: '#333' }} />
                        ) : (
                            <RefreshIcon fontSize="large" />
                        )}
                    </IconButton>

                    <IconButton
                        onClick={handleTogglePush}
                        disabled={pushBusy}
                        aria-label={pushState === 'on' ? 'Benachrichtigungen ausschalten' : 'Benachrichtigungen einschalten'}
                        sx={headerButtonSx}
                    >
                        {pushBusy ? (
                            <CircularProgress size={35} thickness={5} style={{ color: '#333' }} />
                        ) : pushState === 'on' ? (
                            <NotificationsActiveIcon fontSize="large" style={{ color: '#4CAF50' }} />
                        ) : (
                            <NotificationsNoneIcon fontSize="large" />
                        )}
                    </IconButton>

                    <IconButton onClick={handleOpenCalendar} aria-label="Kalender abonnieren" sx={headerButtonSx}>
                        <CalendarMonthIcon fontSize="large" />
                    </IconButton>

                    <FormControl
                        variant="outlined"
                        fullWidth
                        sx={{
                            transition: 'all 0.3s ease-in-out',
                            '&:hover': {
                                boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.5)',
                                transform: 'translateY(-2px)',
                            },
                            '& .MuiInputBase-input': {
                                color: 'white',
                            },
                            '& .MuiInputBase-input:hover': {
                                color: 'rgb(255,255,255)',
                            },
                        }}
                    >
                        <Select
                            value={sortBy}
                            onChange={handleSortChange}
                            style={{ color: '#fef3e3', fontSize: '1.2rem', fontWeight: 'bold' }}
                        >
                            <MenuItem value="input" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                Eingangsdatum
                            </MenuItem>
                            <MenuItem value="date" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                Reservierungsdatum
                            </MenuItem>
                        </Select>
                    </FormControl>

                </Box>
                <Container>
                    {error && (
                        <Alert severity="error" onClose={() => setError(null)} sx={{ mx: '10px', mb: 1 }}>
                            {error}
                        </Alert>
                    )}
                    {info && (
                        <Alert severity="info" onClose={() => setInfo(null)} sx={{ mx: '10px', mb: 1 }}>
                            {info}
                        </Alert>
                    )}
                    {loading ? (
                        <Box display="flex" justifyContent="center" my={2}>
                            <Fade
                                in={loading}
                                style={{ transitionDelay: loading ? '800ms' : '0ms' }}
                                unmountOnExit
                            >
                                <CircularProgress
                                    size={80}
                                    thickness={4.5}
                                    color="inherit"
                                    style={{ color: 'white' }}
                                />
                            </Fade>
                        </Box>
                    ) : (
                        <Box>
                            {emails.slice(0, visibleCount).map((email, index) => (
                                    <Paper
                                        key={email.id}
                                        elevation={3}
                                        style={{
                                            marginBottom: '10px',
                                            padding: '6px',
                                            backgroundColor: 'rgba(0,0,0,0.19)',
                                            borderLeft: email.status ? '5px solid #B23C3CE5' : '5px solid #4CAF50', // Rot wenn Status true, Grün sonst
                                            margin: '10px',
                                            touchAction: 'pan-y'
                                        }}
                                    >
                                        <Accordion
                                            sx={{
                                                transition: 'all 0.3s ease-in-out', // Für eine sanfte Animation
                                                '&:hover': {
                                                    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.5)', // Leichter gelber Glanz beim Hover
                                                    transform: 'translateY(-2px)', // Leichtes Anheben beim Hover
                                                },
                                            }}
                                        >
                                            <AccordionSummary
                                                expandIcon={<ExpandMoreIcon style={{ color: '#B23C3CE5' }} />}
                                                aria-controls={`panel${index}-content`}
                                                id={`panel${index}-header`}
                                                style={{ touchAction: 'pan-y' }}
                                            >
                                                <Grid container spacing={1}>
                                                    <Grid item xs={12}>
                                                        <Typography
                                                            variant="h6"
                                                            component="div"
                                                            align="left"
                                                            style={{
                                                                fontWeight: 'bold',
                                                                color: '#B23C3CE5',
                                                                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
                                                            }}
                                                        >
                                                            {email.name}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12}>
                                                        <Typography
                                                            variant="body1"
                                                            component="div"
                                                            align="left"
                                                            style={{
                                                                fontWeight: 'bold',
                                                                color: 'rgba(178,91,60,0.9)',
                                                                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
                                                            }}
                                                        >
                                                            {email.persons} Personen
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12}>
                                                        <Typography
                                                            variant="body1"
                                                            component="div"
                                                            align="left"
                                                            style={{
                                                                fontWeight: 'bold',
                                                                color: 'rgba(178,137,60,0.9)',
                                                                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
                                                            }}
                                                        >
                                                            {formatDate(email.date)} {/* Reservierungsdatum */}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12}>
                                                        <Typography variant="body2" color="textSecondary" component="div" align="left">
                                                            {formatDate(email.input)} {/* Eingangsdatum */}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <Box display="flex" flexDirection="column">
                                                    <Box display="flex" justifyContent="space-between" mb={2}>
                                                        <Button
                                                            variant="contained"
                                                            color="success"
                                                            onClick={() => handleStatusUpdate(email, true)}
                                                            href={generateMailtoLink(
                                                                email,
                                                                'Angenommen: ',
                                                                `Ihre Reservierung für ${email.persons} Personen am ${formatDate(email.date)} wurde angenommen.\n\nMit freundlichen Grüßen,\nPizzeria Kirschenwiese`
                                                            )}
                                                            style={{
                                                                color: 'white',
                                                                textDecoration: 'none',
                                                                minHeight: '50px',
                                                                width: '48%',
                                                            }}
                                                            startIcon={<CheckIcon style={{ color: 'white' }} />}
                                                            fullWidth
                                                        >
                                                            Annehmen
                                                        </Button>

                                                        <Button
                                                            variant="contained"
                                                            color="error"
                                                            onClick={() => handleStatusUpdate(email, true)}
                                                            href={generateMailtoLink(
                                                                email,
                                                                'Ablehnen: ',
                                                                `Ihre Reservierung für ${email.persons} Personen am ${formatDate(email.date)} ist abgelehnt.\n\nMit freundlichen Grüßen,\nPizzeria Kirschenwiese`
                                                            )}
                                                            style={{
                                                                color: 'white',
                                                                textDecoration: 'none',
                                                                minHeight: '50px',
                                                                width: '48%',
                                                            }}
                                                            startIcon={<CloseIcon style={{ color: 'white' }} />}
                                                            fullWidth
                                                        >
                                                            Ablehnen
                                                        </Button>
                                                    </Box>
                                                    <Button
                                                        variant="contained"
                                                        color="secondary"
                                                        onClick={() => handleStatusUpdate(email, false)}
                                                        startIcon={<Visibility style={{ color: 'white' }} />}
                                                        style={{
                                                            backgroundColor: 'rgb(185,87,185)',  // Blasseres Lila für "Ungelesen Markieren"
                                                            color: 'white',
                                                            textDecoration: 'none',
                                                            minHeight: '25px',
                                                            marginTop: '8px'
                                                        }}
                                                    >
                                                        Ungelesen Markieren
                                                    </Button>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        onClick={() => handleViewFullEmail(email)}
                                                        startIcon={<Reorder style={{ color: 'white' }} />}
                                                        style={{
                                                            backgroundColor: 'rgb(94,172,234)',  // Blasseres Blau für "Ganze Nachricht Ansehen"
                                                            color: 'white',
                                                            textDecoration: 'none',
                                                            minHeight: '25px',
                                                            marginTop: '8px'
                                                        }}
                                                    >
                                                        Ganze Nachricht ansehen
                                                    </Button>
                                                </Box>
                                            </AccordionDetails>
                                        </Accordion>
                                    </Paper>
                            ))}
                            {visibleCount < emails.length && (
                                <Box display="flex" justifyContent="center" my={2}>
                                    <Button
                                        variant="contained"
                                        onClick={() => setVisibleCount(count => count + EMAILS_PER_PAGE)}
                                        style={{ backgroundColor: 'white', color: '#333', fontWeight: 'bold' }}
                                    >
                                        Weitere anzeigen ({emails.length - visibleCount})
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    )}
                </Container>
                <Dialog open={Boolean(calendarUrl)} onClose={() => setCalendarUrl(null)} maxWidth="sm" fullWidth>
                    <DialogTitle>Kalender abonnieren</DialogTitle>
                    <DialogContent dividers>
                        <Typography variant="body1" gutterBottom>
                            Alle Reservierungen (letzte 30 Tage und alle kommenden) erscheinen automatisch in deinem Kalender.
                            Die Kalender-App lädt ungefähr alle 15 Minuten neu.
                        </Typography>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                            Auf dem iPhone: „Direkt abonnieren“ tippen und bestätigen. Oder die Adresse kopieren und unter
                            Einstellungen → Kalender → Accounts → Account hinzufügen → Andere → Kalenderabo hinzufügen einfügen.
                        </Typography>
                        <Typography
                            variant="body2"
                            component="div"
                            sx={{ wordBreak: 'break-all', backgroundColor: '#f5f5f5', p: 1, borderRadius: 1, mt: 1, userSelect: 'all' }}
                        >
                            {calendarUrl}
                        </Typography>
                        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                            Die Adresse ist wie ein Passwort – nicht öffentlich teilen.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCopyCalendarUrl}>Adresse kopieren</Button>
                        <Button
                            variant="contained"
                            href={calendarUrl ? calendarUrl.replace(/^https?:/, 'webcal:') : undefined}
                        >
                            Direkt abonnieren
                        </Button>
                        <Button onClick={() => setCalendarUrl(null)}>Schließen</Button>
                    </DialogActions>
                </Dialog>
                <Dialog open={Boolean(selectedEmail)} onClose={handleCloseDialog} maxWidth="md" fullWidth>
                    <DialogTitle>Ganze Nachricht</DialogTitle>
                    <DialogContent dividers>
                        {selectedEmail && (selectedEmail.text === null ? (
                            <Box display="flex" justifyContent="center" my={2}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <Typography variant="body1" component="div" style={{ whiteSpace: 'pre-wrap' }}>
                                {selectedEmail.text}
                            </Typography>
                        ))}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog} color="primary">
                            Schließen
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </ThemeProvider>
    );
};

export default EmailList;
