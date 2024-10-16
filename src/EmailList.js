import React, { useCallback, useEffect, useState } from 'react';
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
    Zoom,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    FormControl,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import {Reorder, Visibility} from "@mui/icons-material";

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
const backend_url = process.env.REACT_APP_BACKEND_URL;

const EmailList = () => {
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [sortBy, setSortBy] = useState('input');
    const emailsPerPage = 10;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));


    const fetchEmails = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${backend_url}/emails?sortBy=${sortBy}`);
            setEmails(response.data); // Die Datenbankantwort wird hier übernommen
        } catch (error) {
            console.error('Error fetching emails:', error);
        } finally {
            setLoading(false);
        }
    }, [sortBy]);

    useEffect(() => {
        fetchEmails();
    }, [fetchEmails]);

    const handleSortChange = (event) => {
        setSortBy(event.target.value);
    };

    const handleUpdateEmails = () => {
        fetchEmails();
    };

    const generateMailtoLink = (email, subjectPrefix, body) => {
        return `mailto:${email.email}?subject=${(subjectPrefix + "Reservierung Pizzeria Kirschenwiese")}&body=${encodeURIComponent(body)}`;
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleViewFullEmail = (email) => {
        setSelectedEmail(email);
    };

    const handleCloseDialog = () => {
        setSelectedEmail(null);
    };

    const handleStatusUpdate = async (email, status) => {
        try {
            // API-Aufruf zum Setzen des Status auf true und Verwendung des Reservierungsdatums
            const response = await axios.post(`${backend_url}/emails/${email.id}/status`, {
                name: email.name,
                persons: email.persons,
                date: email.dateTime || email.date, // Sende das Reservierungsdatum oder als Fallback das Eingangsdatum
                status: status
            });

            if (response.status === 200) {
                // Erfolg: Setze den Status der E-Mail lokal auf true
                const updatedEmails = emails.map(e =>
                    e.id === email.id ? { ...e, status: true } : e
                );
                setEmails(updatedEmails);  // Aktualisiere den Zustand der E-Mails im Frontend
            }
        } catch (error) {
            console.error('Fehler beim Aktualisieren des Status:', error);
        }
    };

    const handleMarkAsUnread = async (email, status ) => {
        try {
            // API-Aufruf zum Setzen des Status auf false
            const response = await axios.post(`${backend_url}/emails/${email.id}/status`, {
                name: email.name,
                persons: email.persons,
                date: email.dateTime || email.date, // Sende das Reservierungsdatum oder als Fallback das Eingangsdatum
                status: status
            });

            if (response.status === 200) {
                // Erfolg: Setze den Status der E-Mail lokal auf false
                const updatedEmails = emails.map(e =>
                    e.id === email.id ? { ...e, status: false } : e
                );
                setEmails(updatedEmails);  // Aktualisiere den Zustand der E-Mails im Frontend
            }
        } catch (error) {
            console.error('Fehler beim Setzen des Status auf Ungelesen:', error);
        }
    };

    return (
        <ThemeProvider theme={customTheme}>
            <Box display="flex" flexDirection="column" alignItems="center" width={isMobile ? '100%' : '50%'}>
                <img
                    src={`${process.env.PUBLIC_URL}/logo-shadow.png`}
                    alt="Logo"
                    style={{ height: '200px', width: 'auto', cursor: 'pointer' }}
                    onClick={() => fetchEmails()}
                />
                <Box display="flex" justifyContent="center" alignItems="center" mb={2} width={isMobile ? '90%' : '92%'}>
                    <IconButton
                        variant="contained"
                        color="primary"
                        onClick={handleUpdateEmails}
                        sx={{
                            backgroundColor: 'white',
                            color: '#333',
                            marginRight: '10px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            '&:hover': {
                                backgroundColor: 'white',
                                color: '#FFCC00',
                            },
                        }}
                    >
                        <RefreshIcon
                            fontSize="large"
                            sx={{
                                '&:hover': {
                                    color: '#FFCC00',
                                },
                            }}
                        />
                    </IconButton>
                    <FormControl variant="outlined" fullWidth>
                        <Select
                            value={sortBy}
                            onChange={handleSortChange}
                            style={{fontSize: '1.2rem', fontWeight: 'bold' }}
                            sx={{
                                color: 'white',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'white',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'white',
                                },
                                '&:hover': {
                                    color: '#FFCC00',
                                },
                                '& .MuiSvgIcon-root': {
                                    color: 'inherit',
                                },
                            }}
                        >
                            <MenuItem
                                value="input"
                                sx={{
                                    fontSize: '1.2rem',
                                    fontWeight: 'bold',
                                    '&:hover': {
                                        color: '#FFCC00', // Gelber Text beim Hover auf Menü-Items
                                    }
                                }}
                            >
                                Eingangsdatum
                            </MenuItem>
                            <MenuItem
                                value="date"
                                sx={{
                                    fontSize: '1.2rem',
                                    fontWeight: 'bold',
                                    '&:hover': {
                                        color: '#FFCC00', // Gelber Text beim Hover auf Menü-Items
                                    }
                                }}
                            >
                                Reservierungsdatum
                            </MenuItem>
                        </Select>
                    </FormControl>

                </Box>
                <Container>
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
                            {emails.map((email, index) => (
                                <Zoom in={!loading} key={index}>
                                    <Paper
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
                                        <Accordion>
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
                                                            onClick={() => handleStatusUpdate(email, false)}
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
                                                        onClick={() => handleMarkAsUnread(email,false)}
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
                                </Zoom>
                            ))}
                        </Box>
                    )}
                </Container>
                <Dialog open={Boolean(selectedEmail)} onClose={handleCloseDialog} maxWidth="md" fullWidth>
                    <DialogTitle>Ganze Nachricht</DialogTitle>
                    <DialogContent dividers>
                        {selectedEmail && (
                            <Typography variant="body1" component="div" style={{ whiteSpace: 'pre-wrap' }}>
                                {selectedEmail.text}
                            </Typography>
                        )}
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
