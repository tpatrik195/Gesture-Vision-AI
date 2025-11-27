import React, { useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { Box, Container, Grid, Typography, Button, Card, CardContent } from '@mui/material';
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
      title:t('homePage.tryItTitle'),
      desc: t('homePage.tryItDescription'),
      tryIt: true,
    },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #06200eff 5%, #0c0d31 30%, #003278ff 70%, #030044b8 100%)',
        color: '#f0f0f0',
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
                // navigation
                // pagination={{ clickable: true }}
                autoplay={{ delay: 3000, disableOnInteraction: false }}
                loop
                style={{ position: 'relative', zIndex: 1, borderRadius: '20px', height: '400px' }}
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
                  background: 'linear-gradient(90deg, #aa00ff, #00ffbb)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Gesture Vision AI
              </Typography>

              <Typography variant="h5" sx={{ mb: 2, color: '#f0f0f0' }}>
                {t('homePage.subtitle')}
              </Typography>

              <Typography variant="body1" sx={{ mb: 4, color: '#f0f0f0' }}>
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
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 0 20px 5px rgba(170, 0, 255, 0.25), 0 0 30px 10px rgba(0, 0, 0, 0.1)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    color: '#e0f7fa',
                    position: 'relative',
                    overflow: 'visible',
                  }}
                >
                  <CardContent>
                    <Typography variant="h5" sx={{ mb: 2, color: '#f0f0f0', fontWeight: 600 }}>
                      {f.icon} {f.title}
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#d0f0f5', mb: 2, fontSize: '1.05rem' }}>
                      {f.desc}
                    </Typography>
                    {f.extra &&
                      f.extra.map((ex, i) => (
                        <Box key={i} sx={{ mt: 1 }}>
                          <Typography variant="subtitle1" sx={{ mb: 0.5, color: '#f0f0f0', fontWeight: 600 }}>
                            {ex.icon} {ex.title}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#c0e8f5', fontSize: '1rem' }}>
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
                          background: 'linear-gradient(90deg, #aa00ff, #00ffbb)',
                          color: 'white',
                          fontWeight: 'bold',
                          borderRadius: '12px',
                          boxShadow: '0px 4px 20px rgba(170,0,255,0.5)',
                          '&:hover': { boxShadow: '0px 6px 30px rgba(0,255,187,0.7)' },
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
    </Box>
  );
};

export default HomePage;