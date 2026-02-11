import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { Box } from '@mui/material';

export default function PracticeCard({ id, name, image, t }) {
  const navigate = useNavigate();

  return (
    <Card
      sx={{
        width: 360,
        height: 360,
        margin: 3,
        position: 'relative',
        backgroundImage: `url(${image || ''})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'white',
        cursor: 'pointer',
        borderRadius: 2,
        overflow: 'hidden'
      }}
      onClick={() => navigate(`/practice/${id}`)}
    >
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          background: 'rgba(0, 0, 0, 0)',
          padding: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <Typography variant="h5" component="div" sx={{ color: 'white', mb: 1 }}>
          {name}
        </Typography>
        <Button variant="contained" size="small" sx={{ backgroundColor: 'rgba(255, 255, 255, 0.5)', color: 'black' }}>
          {t('practiceCard.tryGesture')}
        </Button>
      </Box>
    </Card>
  );
}
