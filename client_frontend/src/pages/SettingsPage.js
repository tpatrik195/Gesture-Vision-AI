import {
  Box,
  Divider,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Grid,
  Button
} from "@mui/material";
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

  const handleSave = () => {
    sessionStorage.setItem("gestureSettings", JSON.stringify(settings));
    alert(t('settingsPage.savedMessage') || 'Settings saved!');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #faf6ef 0%, #f1e8dc 100%)',
        color: '#4a2f28',
        py: 12,
        px: { xs: 2, md: 6 },
      }}
    >
      <Typography
        variant="h3"
        textAlign="center"
        sx={{ mb: 2, fontWeight: 'bold', color: '#7a1f1a' }}
      >
        {t('settingsPage.title')}
      </Typography>

      <Typography
        variant="h6"
        textAlign="center"
        sx={{ mb: 5, color: '#5a3a2e' }}
      >
        {t('settingsPage.subtitle')}
      </Typography>

      <Grid container spacing={4} justifyContent="center">
        {Gestures.map((gesture) => (
          <Grid item xs={12} sm={6} md={4} key={gesture.name}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: '20px',
                background: 'linear-gradient(180deg, #ffffff 0%, #f6efe6 100%)',
                boxShadow: '0 10px 30px rgba(90,58,46,0.18)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                border: '1px solid #e6d8c8',
              }}
            >
              <Typography fontWeight="bold" sx={{ color: '#7a1f1a' }}>
                {gesture.name}
              </Typography>

              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: '#6a4a3c' }}>
                  {t('settingsPage.chooseOption')}
                </InputLabel>

                <Select
                  value={settings[gesture.name] || ""}
                  onChange={(e) => handleChange(gesture, e.target.value)}
                  label={t('settingsPage.chooseOption')}
                  sx={{
                    color: '#4a2f28',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#d6c5b3',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#7a1f1a',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#7a1f1a',
                    },
                    '& .MuiSvgIcon-root': {
                      color: '#7a1f1a',
                    },
                  }}
                >
                  <MenuItem value="">
                    {t('settingsPage.chooseOption')}
                  </MenuItem>

                  {Options
                    .filter(o => !selectedOptions.includes(o) || settings[gesture.name] === o)
                    .map(o => (
                      <MenuItem key={o} value={o}>
                        {o}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Debug mode */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          mt: 6,
          gap: 2,
        }}
      >
        <Typography fontWeight="bold" sx={{ color: '#5a3a2e' }}>
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
                  color: '#7a1f1a',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#7a1f1a',
                },
                '& .MuiSwitch-track': {
                  backgroundColor: '#d6c5b3',
                },
              }}
            />
          }
          label=""
        />
      </Box>

      {/* Save button */}
      <Box sx={{ textAlign: 'center', mt: 6 }}>
        <Button
          variant="contained"
          sx={{
            background: 'linear-gradient(90deg, #7a1f1a, #5a3a2e)',
            color: '#fff',
            fontWeight: 'bold',
            borderRadius: '14px',
            px: 6,
            py: 1.5,
            boxShadow: '0 8px 24px rgba(122,31,26,0.45)',
            '&:hover': {
              background: 'linear-gradient(90deg, #5a1814, #4a2f28)',
            },
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