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
        color: '#4b2e2b',
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
                  color: '#6b1f1a', // sötét vörös
                }}
              >
                Gesture Vision AI
              </Typography>

              <Typography variant="h5" sx={{ mb: 2, color: '#5a3a2e' }}>
                {t('homePage.subtitle')}
              </Typography>

              <Typography variant="body1" sx={{ mb: 4, color: '#6a4a3c' }}>
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
                    color: '#4b2e2b',
                  }}
                >
                  <CardContent>
                    <Typography
                      variant="h5"
                      sx={{ mb: 2, fontWeight: 600, color: '#6b1f1a' }}
                    >
                      {f.icon} {f.title}
                    </Typography>

                    <Typography
                      variant="body1"
                      sx={{ mb: 2, color: '#5a3a2e', fontSize: '1.05rem' }}
                    >
                      {f.desc}
                    </Typography>

                    {f.extra &&
                      f.extra.map((ex, i) => (
                        <Box key={i} sx={{ mt: 1 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{ mb: 0.5, fontWeight: 600, color: '#6b1f1a' }}
                          >
                            {ex.icon} {ex.title}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: '#6a4a3c', fontSize: '1rem' }}
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
                          background: '#6b1f1a',
                          color: '#fff',
                          fontWeight: 'bold',
                          borderRadius: '12px',
                          px: 4,
                          boxShadow: '0 6px 20px rgba(107,31,26,0.4)',
                          '&:hover': {
                            background: '#5a1814',
                            boxShadow: '0 8px 30px rgba(107,31,26,0.6)',
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
    </Box>
  );
};

export default HomePage;