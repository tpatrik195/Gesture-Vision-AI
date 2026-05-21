import { Box, Container, Typography, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <Box
      component="footer"
      sx={{
        width: '100%',
        py: 4,
        background: 'linear-gradient(135deg, #e9e0d4 0%, #ded2c3 100%)',
        borderTop: '1px solid rgba(74, 47, 40, 0.15)',
      }}
    >
      <Container
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#5a1814', mb: 0.5 }}>
            Gesture Vision AI
          </Typography>
          <Typography variant="body2" sx={{ color: '#4a2f28' }}>
            {t('homePage.footerTagline')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            <Link
              href="mailto:info@gesturevisionai.com"
              sx={{
                color: '#4a2f28',
                textDecorationColor: 'rgba(74, 47, 40, 0.5)',
                '&:hover': {
                  color: '#2f5a3a',
                  textDecorationColor: '#2f5a3a',
                },
              }}
            >
              info@gesturevisionai.com
            </Link>
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ color: '#50362b', fontWeight: 600 }}>
          {t('homePage.footerCopyright')}
        </Typography>
      </Container>
    </Box>
  );
};

export default Footer;
