import React from 'react';
import PracticeCard from "../components/PracticeCard";
import { getGestures } from "../utils/gestureOptions";
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';

const PracticePage = () => {
    const { t } = useTranslation();
    const gestures = getGestures(t);
    return (
        <Box
            style={{
                background: 'linear-gradient(135deg, #faf7f2 0%, #f3efe7 100%)',
                minHeight: '100vh',
                overflowX: 'hidden',
            }}
            sx={{ paddingTop: '60px', px: { xs: 2, md: 6 } }}
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        md: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: 4,
                    maxWidth: 1200,
                    mx: 'auto',
                }}
            >
                {gestures.map((gesture, index) => (
                    <PracticeCard key={index} id={gesture.id} name={gesture.name} image={gesture.image} t={t} />
                ))}
            </Box>
        </Box>
    );
};

export default PracticePage;
