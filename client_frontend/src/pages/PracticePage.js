import React from 'react';
import PracticeCard from "../components/PracticeCard";
import { getGestures } from "../utils/gestureOptions";
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';

const PracticePage = () => {
    const { t } = useTranslation();
    const gestures = getGestures(t);
    return (
        <Box style={{ 
            display: 'flex',
            flexWrap: 'wrap',
            background: 'linear-gradient(135deg, #030044b8 5%, #0c0d31 30%, #003278ff 70%, #06200eff 100%)',
            minHeight: '100vh',
            overflowX: 'hidden'
        }}
        sx={{paddingTop: '60px'}}
        >
            {gestures.map((gesture, index) => (
                <PracticeCard key={index} id={gesture.id} name={gesture.name} image={gesture.image} t={t} />
            ))}
        </Box>
    );
};

export default PracticePage;