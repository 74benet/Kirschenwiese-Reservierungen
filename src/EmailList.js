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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

const customTheme = createTheme({
    components: {
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#fef3e3',
                    },
                    color: '#fef3e3',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#FFCC00', // Custom hover color
                },
                notchedOutline: {
                    borderColor: '#fef3e3',
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                icon: {
                    color: '#fef3e3',
                },
                select: {
                    '&:focus': {
                        backgroundColor: 'transparent',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#FFCC00', // Custom hover color for Select
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
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
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [sortBy, setSortBy] = useState('receivedDate');
    const emailsPerPage = 10;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const fetchEmails = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${backend_url}${sortBy}`);
            setEmails(response.data);
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

    const indexOfLastEmail = currentPage * emailsPerPage;
    const indexOfFirstEmail = indexOfLastEmail - emailsPerPage;
    const currentEmails = emails.slice(indexOfFirstEmail, indexOfLastEmail);

    const paginate = (pageNumber) => {
        setCurrentPage(pageNumber);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const generateMailtoLink = (email, subjectPrefix, body) => {
        return `mailto:${email.userEmail}?subject=${encodeURIComponent(subjectPrefix + email.subject)}&body=${encodeURIComponent(body)}`;
    };

    const isStandardReservation = (email) => {
        return email.text.includes('Auf den Namen:') && email.text.includes('Für:') && email.text.includes('Am.');
    };

    const handleViewFullEmail = (email) => {
        setSelectedEmail(email);
    };

    const handleCloseDialog = () => {
        setSelectedEmail(null);
    };

    const formatEmailText = (text) => {
        const formattedText = text
            .replace(/Unbestätige Reservierungen ansehen\s*\[.*?\]/g, '')
            .replace(/Diese Reservierung bestätigen\s*\[.*?\]/g, '')
            .replace(/Reservierung ablehnen\s*\[.*?\]/g, '')
            .replace("Diese Mitteilung wurde von Kirschenwiese Restaurant Heilbronn-Abstatt\n" +
                "[https://pizzeria-kirschenwiese.de/]", '')
        return formattedText;
    };

    return (
        <ThemeProvider theme={customTheme}>
            <Box display="flex" flexDirection="column" alignItems="center" width={isMobile ? '100%' : '50%'}>
                <img
                    src={`${process.env.PUBLIC_URL}/logo-shadow.png`}
                    alt="Logo"
                    style={{ height: '200px', width: 'auto', cursor: 'pointer' }}
                    onClick={() => setCurrentPage(1)}
                />
                <Box display="flex" justifyContent="center" alignItems="center" mb={2} width={isMobile ? '90%' : '92%'}>
                    <IconButton
                        variant="contained"
                        color="primary"
                        onClick={handleUpdateEmails}
                        style={{
                            backgroundColor: 'white',
                            color: '#333',
                            marginRight: '10px',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                        }}
                    >
                        <RefreshIcon fontSize="large" />
                    </IconButton>
                    <FormControl variant="outlined" fullWidth>
                        <Select
                            value={sortBy}
                            onChange={handleSortChange}
                            style={{ color: '#fef3e3', fontSize: '1.2rem', fontWeight: 'bold' }}
                        >
                            <MenuItem value="receivedDate" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Eingangsdatum</MenuItem>
                            <MenuItem value="reservationDate" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Reservierungsdatum</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
                <Container>
                    {loading ? (
                        <Box display="flex" justifyContent="center" my={2}>
                            <Fade
                                in={loading}
                                style={{
                                    transitionDelay: loading ? '800ms' : '0ms',
                                }}
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
                            {currentEmails.map((email, index) => (
                                <Zoom in={!loading} key={index}>
                                    <Paper
                                        elevation={3}
                                        style={{
                                            marginBottom: '6px',
                                            padding: '6px',
                                            backgroundColor: 'rgba(0,0,0,0.19)',
                                            borderLeft: `5px solid ${'#B23C3CE5'}`,
                                            margin: '0 6px',
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
                                                    {isStandardReservation(email) ? (
                                                        <>
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
                                                                    {email.formattedDateTime}
                                                                </Typography>
                                                            </Grid>
                                                        </>
                                                    ) : (
                                                        <Grid item xs={12}>
                                                            <Typography
                                                                variant="body1"
                                                                component="div"
                                                                align="left"
                                                                style={{
                                                                    fontWeight: 'bold',
                                                                    color: '#B23C3CE5',
                                                                    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
                                                                }}
                                                            >
                                                                Frage
                                                            </Typography>
                                                        </Grid>
                                                    )}
                                                    <Grid item xs={12}>
                                                        <Typography variant="body2" color="textSecondary" component="div" align="left">
                                                            {email.formattedDate}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <Box display="flex" flexDirection="column">
                                                    {isStandardReservation(email) ? (
                                                        <>
                                                            <Typography
                                                                variant="body1"
                                                                component="a"
                                                                href={generateMailtoLink(
                                                                    email,
                                                                    'Annehmen: ',
                                                                    `Ihre Reservierung für ${email.persons} Personen am ${email.formattedDateTime} ist angenommen.\n\nMit freundlichen Grüßen,\nPizzeria Kirschenwiese`
                                                                )}
                                                                style={{
                                                                    color: theme.palette.primary.main,
                                                                    textDecoration: 'none',
                                                                    marginBottom: '8px',
                                                                }}
                                                            >
                                                                Annehmen
                                                            </Typography>
                                                            <Typography
                                                                variant="body1"
                                                                component="a"
                                                                href={generateMailtoLink(
                                                                    email,
                                                                    'Ablehnen: ',
                                                                    `Ihre Reservierung für ${email.persons} Personen am ${email.formattedDateTime} ist abgelehnt.\n\nMit freundlichen Grüßen,\nPizzeria Kirschenwiese`
                                                                )}
                                                                style={{
                                                                    color: theme.palette.error.main,
                                                                    textDecoration: 'none',
                                                                }}
                                                            >
                                                                Ablehnen
                                                            </Typography>
                                                            <Button
                                                                variant="outlined"
                                                                color="primary"
                                                                onClick={() => handleViewFullEmail(email)}
                                                                style={{ marginTop: '8px' }}
                                                            >
                                                                Ganze Nachricht ansehen
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Typography variant="body1" component="p">
                                                            {email.text}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </AccordionDetails>
                                        </Accordion>
                                    </Paper>
                                </Zoom>
                            ))}
                            <Box display="flex" justifyContent="center" alignItems="center" my={2}>
                                <IconButton
                                    onClick={() => paginate(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    aria-label="previous page"
                                    style={{ color: 'white', fontSize: '24px' }}
                                >
                                    <ArrowBackIcon fontSize="large" />
                                </IconButton>
                                <Typography
                                    variant="h4"
                                    mx={2}
                                    style={{ color: 'white', fontWeight: 'bold', textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)' }}
                                >
                                    {currentPage}
                                </Typography>
                                <IconButton
                                    onClick={() => paginate(currentPage + 1)}
                                    disabled={currentPage === Math.ceil(emails.length / emailsPerPage)}
                                    aria-label="next page"
                                    style={{ color: 'white', fontSize: '24px' }}
                                >
                                    <ArrowForwardIcon fontSize="large" />
                                </IconButton>
                            </Box>
                        </Box>
                    )}
                </Container>
                <Dialog open={Boolean(selectedEmail)} onClose={handleCloseDialog} maxWidth="md" fullWidth>
                    <DialogTitle>Ganze Nachricht</DialogTitle>
                    <DialogContent dividers>
                        {selectedEmail && (
                            <Typography variant="body1" component="div" style={{ whiteSpace: 'pre-wrap' }}>
                                {formatEmailText(selectedEmail.text)}
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
