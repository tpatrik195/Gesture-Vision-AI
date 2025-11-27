import { Box, Divider, Typography, Paper, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel, Grid, Button } from "@mui/material";
import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { getGestures, getOptions, defaultSettings } from "../utils/gestureOptions";

const SettingsPage = () => {
    const { t } = useTranslation();

    const Gestures = getGestures(t).slice(0, 9);
    const Options = getOptions(t);

    const [settings, setSettings] = useState({});

    useEffect(() => {
        const storedSettings = sessionStorage.getItem("gestureSettings");
        if (storedSettings) {
            setSettings(JSON.parse(storedSettings));
        } else {
            setSettings(defaultSettings);
            sessionStorage.setItem("gestureSettings", JSON.stringify(defaultSettings));
        }
    }, []);

    const handleChange = (gesture, action) => {
        const newSettings = { ...settings, [gesture.name]: action };
        setSettings(newSettings);
        sessionStorage.setItem("gestureSettings", JSON.stringify(newSettings));
    };

    const selectedOptions = Object.values(settings);

    const handleDebugToggle = (event) => {
        const newSettings = { ...settings, debugMode: event.target.checked };
        setSettings(newSettings);
        sessionStorage.setItem("gestureSettings", JSON.stringify(newSettings));
    };

    const handleSave = () => {
        sessionStorage.setItem("gestureSettings", JSON.stringify(settings));
        alert(t('settingsPage.savedMessage') || 'Settings saved!');
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #06200eff 1%, #0c0d31 20%, #0c0d31 70%, #003278ff 100%)',
                color: '#f9f9f9',
                py: 12,
                px: { xs: 2, md: 6 },
            }}
        >
            <Typography
                variant="h3"
                textAlign="center"
                sx={{ mb: 4, color: '#f9f9f9', fontWeight: 'bold' }}
            >
                {t('settingsPage.title')}
            </Typography>
            <Typography
                variant="h6"
                textAlign="center"
                sx={{ mb: 3, color: '#f9f9f9' }}
            >
                {t('settingsPage.subtitle')}
            </Typography>

            <Grid container spacing={4} justifyContent="center">
                {Gestures.map((gesture) => (
                    <Grid item xs={12} sm={6} md={4} key={gesture.name}>
                        <Paper
                            elevation={6}
                            sx={{
                                p: 3,
                                borderRadius: '20px',
                                backdropFilter: 'blur(10px)',
                                background: 'rgba(255,255,255,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                            }}
                        >
                            <Typography fontWeight="bold" sx={{ color: '#f9f9f9' }}>
                                {gesture.name}
                            </Typography>
                            <FormControl size="small">
                                <InputLabel sx={{ color: '#f9f9f9' }}>{t('settingsPage.chooseOption')}</InputLabel>
                                <Select
                                    value={settings[gesture.name] || ""}
                                    onChange={(e) => handleChange(gesture, e.target.value)}
                                    sx={{
                                        color: '#f9f9f9',
                                        '& .MuiSvgIcon-root': { color: '#f9f9f9' },
                                    }}
                                >
                                    <MenuItem value="" sx={{ color: '#000' }}>{t('settingsPage.chooseOption')}</MenuItem>
                                    {Options.filter(o => !selectedOptions.includes(o) || settings[gesture.name] === o)
                                        .map(o => <MenuItem key={o} value={o} sx={{ color: '#000' }}>{o}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 4 }}>
                <Typography fontWeight="bold" sx={{ color: '#f9f9f9', paddingRight: '30px', paddingLeft: '30px' }}>
                    {t("settingsPage.debugMode")}
                </Typography>
                <FormControlLabel
                    control={
                        <Switch
                            checked={!!settings.debugMode}
                            onChange={(e) => {
                                const newSettings = { ...settings, debugMode: e.target.checked };
                                setSettings(newSettings);
                                sessionStorage.setItem("gestureSettings", JSON.stringify(newSettings));
                            }}
                            sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: '#ffffffff',
                                },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    backgroundColor: '#3570C0',
                                },
                                '& .MuiSwitch-track': {
                                    backgroundColor: '#555',
                                },
                            }}
                        />
                    }
                    label=""
                />
            </Box>

            <Box sx={{ textAlign: 'center', mt: 6 }}>
                <Button
                    variant="contained"
                    sx={{
                        background: 'white',
                        
                        color: 'black',
                        fontWeight: 'bold',
                        borderRadius: '12px',
                        boxShadow: '0px 0px 10px rgba(0,255,187,0.7)',
                        '&:hover': { boxShadow: '0px 0px 40px rgba(170,0,255,0.5)' },
                        px: 6,
                        py: 1.5,
                    }}
                    onClick={handleSave}
                >
                    {t('settingsPage.saveButton')}
                </Button>
            </Box>
        </Box>
    );
};

export default SettingsPage;