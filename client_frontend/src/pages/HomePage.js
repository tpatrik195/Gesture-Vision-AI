import React, { useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { Box, Container, Grid, Typography, Button, Card, CardContent, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { motion, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import slide1 from '../pictures/slider1.webp';
import slide2 from '../pictures/slider2.jpeg';
import slide3 from '../pictures/slider3.jpeg';

const HomePage = () => {
  const { t } = useTranslation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const navigate = useNavigate();

  const features = [
    {
      icon: '🎯',
      title: t('homePage.func1Title'),
      desc: t('homePage.func1Description'),
      extra: [
        { icon: '🎥', title: t('homePage.func2Title'), desc: t('homePage.func2Description') },
        { icon: '🔍', title: t('homePage.func3Title'), desc: t('homePage.func3Description') },
      ],
    },
    {
      icon: '🛠️',
      title: t('homePage.func4Title'),
      desc: t('homePage.func4Description'),
      extra: [
        { icon: '📺', title: t('homePage.func5Title'), desc: t('homePage.func5Description') },
      ],
    },
    {
      icon: '🖥️',
      title: t('homePage.tryItTitle'),
      desc: t('homePage.tryItDescription'),
      tryIt: true,
    },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #faf7f2 0%, #f3efe7 100%)',
        color: '#3a241f',
        overflowX: 'hidden',
      }}
    >
      <Container sx={{ py: 12 }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Swiper
              modules={[Autoplay, Navigation, Pagination]}
              spaceBetween={20}
              slidesPerView={1}
              autoplay={{ delay: 3000, disableOnInteraction: false }}
              loop
              style={{
                position: 'relative',
                zIndex: 1,
                borderRadius: '20px',
                height: '400px',
                boxShadow: '0 10px 30px rgba(75,46,43,0.25)',
              }}
            >
              <SwiperSlide>
                <img
                  src={slide1}
                  alt="Slide 1"
                  style={{ width: '100%', objectFit: 'cover', height: '400px' }}
                />
              </SwiperSlide>
              <SwiperSlide>
                <img
                  src={slide2}
                  alt="Slide 2"
                  style={{ width: '100%', objectFit: 'cover', height: '400px' }}
                />
              </SwiperSlide>
              <SwiperSlide>
                <img
                  src={slide3}
                  alt="Slide 3"
                  style={{ width: '100%', objectFit: 'cover', height: '400px' }}
                />
              </SwiperSlide>
            </Swiper>
          </Grid>

          <Grid item xs={12} md={6}>
            <motion.div
              ref={ref}
              initial={{ opacity: 0, x: 150 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <Typography
                variant="h2"
                fontWeight="bold"
                sx={{
                  mb: 2,
                  color: '#5a1814',
                }}
              >
                Gesture Vision <span style={{ color: '#2f5a3a' }}>AI</span>
              </Typography>

              <Typography variant="h5" sx={{ mb: 2, color: '#482d24' }}>
                {t('homePage.subtitle')}
              </Typography>

              <Typography variant="body1" sx={{ mb: 4, color: '#50362b' }}>
                {t('homePage.subsubtitle')}
              </Typography>
            </motion.div>
          </Grid>
        </Grid>

        <Box sx={{ my: 6 }} />

        <Grid container spacing={4}>
          {features.map((f, idx) => (
            <Grid item xs={12} md={4} key={idx}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: idx * 0.2 }}
              >
                <Card
                  sx={{
                    p: 4,
                    borderRadius: '20px',
                    background: '#ffffff',
                    boxShadow: '0 8px 30px rgba(75,46,43,0.15)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    color: '#3a241f',
                  }}
                >
                  <CardContent>
                    <Typography
                      variant="h5"
                      sx={{ mb: 2, fontWeight: 600, color: '#5a1814' }}
                    >
                      {f.icon} {f.title}
                    </Typography>

                    <Typography
                      variant="body1"
                      sx={{ mb: 2, color: '#482d24', fontSize: '1.05rem' }}
                    >
                      {f.desc}
                    </Typography>

                    {f.extra &&
                      f.extra.map((ex, i) => (
                        <Box key={i} sx={{ mt: 1 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{ mb: 0.5, fontWeight: 600, color: '#5a1814' }}
                          >
                            {ex.icon} {ex.title}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: '#50362b', fontSize: '1rem' }}
                          >
                            {ex.desc}
                          </Typography>
                        </Box>
                      ))}
                  </CardContent>

                  {f.tryIt && (
                    <Box sx={{ mt: 3 }}>
                      <Button
                        variant="contained"
                        sx={{
                          background: '#2f5a3a',
                          color: '#fff',
                          fontWeight: 'bold',
                          borderRadius: '12px',
                          px: 4,
                          '&:hover': {
                            background: '#254930',
                          },
                        }}
                        onClick={() => navigate('/presentation')}
                      >
                        {t('homePage.tryItButton')}
                      </Button>
                    </Box>
                  )}
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box
        component="footer"
        sx={{
          mt: 10,
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
    </Box>
  );
};

export default HomePage;
