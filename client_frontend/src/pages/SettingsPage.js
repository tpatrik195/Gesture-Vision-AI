import { Box, Divider, Typography, Paper, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel } from "@mui/material";
import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { getGestures, getActions, loadSettings, saveSettings } from "../utils/gestureOptions";

const SettingsPage = () => {
    const { t } = useTranslation();

    const Gestures = getGestures(t);
    const Options = getActions(t);

    const [settings, setSettings] = useState({});

    useEffect(() => {
        setSettings(loadSettings());
    }, []);

    const persist = (newSettings) => {
        setSettings(newSettings);
        saveSettings(newSettings);
    };

    const handleChange = (gesture, action) => {
        persist({ ...settings, [gesture.key]: action });
    };

    const selectedOptions = Object.values(settings);

    const handleDebugToggle = (event) => {
        persist({ ...settings, debugMode: event.target.checked });
    };

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: { xs: 'flex-start', md: 'center' },
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #faf7f2 0%, #f3efe7 100%)',
                color: '#4a2f28',
                pt: { xs: 9, md: 10 },
                pb: { xs: 4, md: 10 },
                px: { xs: 2, md: 6 },
            }}
        >
            <Paper
                elevation={4}
                sx={{
                    width: { xs: '80%', sm: '65%', md: '50%', lg: '50%' },
                    padding: '24px',
                    borderRadius: '12px',
                    backgroundColor: '#f9f9f9',
                    mt: { xs: 0, md: -8 },
                }}
            >
                <Typography variant="h5" fontWeight="bold" textAlign="center" marginBottom={2}>
                    {t('settingsPage.title')}
                </Typography>
                <Divider sx={{ marginBottom: 2 }} />
                {Gestures.map((gesture) => (
                    <Box key={gesture.name} sx={{ marginBottom: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography fontWeight="bold" sx={{ flex: 1 }}>
                                {gesture.name}
                            </Typography>
                            <FormControl size="small" sx={{ width: '40%' }}>
                                <InputLabel
                                    id={`${gesture.name}-label`}
                                    sx={{
                                        color: '#000',
                                        '&.Mui-focused': { color: '#6b1f1a' },
                                    }}
                                >
                                    {t('settingsPage.chooseOption')}
                                </InputLabel>
                                <Select
                                    labelId={`${gesture.name}-label`}
                                    value={settings[gesture.key] || ""}
                                    onChange={(e) => handleChange(gesture, e.target.value)}
                                    label={t('settingsPage.chooseOption')}
                                    sx={{
                                        width: '100%',
                                        padding: '4px',
                                        fontSize: '0.875rem',
                                        height: '35px',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#d6c5b3',
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#6b1f1a',
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#6b1f1a',
                                        },
                                        '& .MuiSvgIcon-root': {
                                            color: '#6b1f1a',
                                        },
                                    }}
                                >
                                    <MenuItem value="">{t('settingsPage.chooseOption')}</MenuItem>
                                    {Options
                                        .filter(({ action }) => !selectedOptions.includes(action) || settings[gesture.key] === action)
                                        .map(({ action, label }) => (
                                            <MenuItem key={action} value={action}>
                                                {label}
                                            </MenuItem>
                                        ))}

                                </Select>
                            </FormControl>
                        </Box>
                        <Divider sx={{ marginTop: 1 }} />
                    </Box>
                ))}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography fontWeight="bold">{t("settingsPage.debugMode")}</Typography>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={!!settings.debugMode}
                                    onChange={handleDebugToggle}
                                    sx={{
                                        '& .MuiSwitch-switchBase.Mui-checked': {
                                            color: '#6b1f1a',
                                        },
                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                            backgroundColor: '#6b1f1a',
                                        },
                                    }}
                                />
                            }
                        />
                </Box>
            </Paper>
        </Box>
    );
};

export default SettingsPage;
