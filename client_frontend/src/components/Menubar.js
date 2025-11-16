// import { useState } from 'react';
// import { useTranslation } from 'react-i18next';
// import { useNavigate, useLocation } from 'react-router-dom';
// import { AppBar, Toolbar, Button, MenuItem, Typography, Box } from '@mui/material';
// import LanguageIcon from '@mui/icons-material/Language';
// import { EnglishFlag } from '../pictures/englishFlag';
// import { HungaryFlag } from '../pictures/hungaryFlag';
// import { RomaniaFlag } from '../pictures/romaniaFlag';

// const MenuBar = ({ menuItems }) => {
//     const { i18n } = useTranslation();
//     const [open, setOpen] = useState(false);
//     const navigate = useNavigate();
//     const location = useLocation();

//     const handleToggle = () => {
//         setOpen(!open);
//     };

//     const handleLanguageChange = (newLanguage) => {
//         i18n.changeLanguage(newLanguage);
//         setOpen(false);
//     };

//     const handleItemClick = (path) => {
//         navigate(path);
//     };

//     return (
//         <AppBar position="static" sx={{ backgroundColor: '#333', boxShadow: 'none' }}>
//             <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
//                 <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
//                     Gesture Vision AI
//                 </Typography>

//                 <Box sx={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
//                     {menuItems.map((item, index) => (
//                         <Button
//                             key={index}
//                             color="inherit"
//                             onClick={() => handleItemClick(item.path)}
//                             sx={{
//                                 marginLeft: '30px',
//                                 marginRight: '30px',
//                                 backgroundColor: location.pathname === item.path ? 'black' : 'transparent',
//                                 color: location.pathname === item.path ? 'white' : 'inherit',
//                                 fontWeight: 'bold',
//                                 textTransform: 'uppercase',
//                                 '&:hover': {
//                                     backgroundColor: '#555',
//                                 },
//                             }}
//                         >
//                             {item.label}
//                         </Button>
//                     ))}
//                 </Box>

//                 <Box sx={{ position: 'relative' }}>
//                     <LanguageIcon sx={{ cursor: 'pointer', color: 'white' }} onClick={handleToggle} />
//                     {open && (
//                         <Box sx={{
//                             position: 'absolute',
//                             right: 0,
//                             backgroundColor: '#fff',
//                             borderRadius: '5px',
//                             zIndex: 1,
//                             color: 'black',
//                             padding: '5px 10px',
//                             boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
//                         }}>
//                             <MenuItem onClick={() => handleLanguageChange('en')} sx={{ display: 'flex', alignItems: 'center' }}>
//                                 <EnglishFlag sx={{ marginRight: '8px' }} />
//                                 English
//                             </MenuItem>
//                             <MenuItem onClick={() => handleLanguageChange('hu')} sx={{ display: 'flex', alignItems: 'center' }}>
//                                 <HungaryFlag sx={{ marginRight: '8px' }} />
//                                 Magyar
//                             </MenuItem>
//                             <MenuItem onClick={() => handleLanguageChange('ro')} sx={{ display: 'flex', alignItems: 'center' }}>
//                                 <RomaniaFlag sx={{ marginRight: '8px' }} />
//                                 Română
//                             </MenuItem>
//                         </Box>
//                     )}
//                 </Box>
//             </Toolbar>
//         </AppBar>
//     );
// };

// export default MenuBar;
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Button, MenuItem, Typography, Box } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import { EnglishFlag } from '../pictures/englishFlag';
import { HungaryFlag } from '../pictures/hungaryFlag';
import { RomaniaFlag } from '../pictures/romaniaFlag';

const MenuBar = ({ menuItems }) => {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const [showBar, setShowBar] = useState(true);
    const [lastScroll, setLastScroll] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();

    const handleToggle = () => setOpen(!open);

    const handleLanguageChange = (newLanguage) => {
        i18n.changeLanguage(newLanguage);
        setOpen(false);
    };

    const handleItemClick = (path) => navigate(path);

    useEffect(() => {
        const handleScroll = () => {
            const currentScroll = window.scrollY;

            if (currentScroll > lastScroll && currentScroll > 60) {
                setShowBar(false);
            } else {
                setShowBar(true);
            }

            setLastScroll(currentScroll);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScroll]);

    return (
        <AppBar
            position="fixed"
            sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                boxShadow: 'none',
                backdropFilter: 'blur(6px)',
                transform: showBar ? 'translateY(0)' : 'translateY(-100%)',
                transition: 'transform 0.3s ease',
            }}
        >
            <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
                {/* <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                    Gesture Vision AI
                </Typography> */}

                <Box sx={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
                    {menuItems.map((item, index) => (
                        <Button
                            key={index}
                            color="inherit"
                            onClick={() => handleItemClick(item.path)}
                            sx={{
                                marginLeft: '30px',
                                marginRight: '30px',
                                backgroundColor: location.pathname === item.path ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
                                color: location.pathname === item.path ? 'white' : 'inherit',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                '&:hover': {
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                },
                            }}
                        >
                            {item.label}
                        </Button>
                    ))}
                </Box>

                <Box sx={{ position: 'relative' }}>
                    <LanguageIcon sx={{ cursor: 'pointer', color: 'white' }} onClick={handleToggle} />
                    {open && (
                        <Box
                            // sx={{
                            //     position: 'absolute',
                            //     right: 0,
                            //     backgroundColor: '#ffffffff',
                            //     borderRadius: '5px',
                            //     zIndex: 1,
                            //     color: 'black',
                            //     padding: '5px 10px',
                            //     boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
                            // }}
                            sx={{
                                position: 'absolute',
                                right: 0,
                                backgroundColor: 'rgba(0,0,0,0.3)', // átlagos átlátszó fekete, mint a menubar
                                backdropFilter: 'blur(6px)', // blur ugyanaz, mint a menubar
                                borderRadius: '5px',
                                zIndex: 1,
                                color: 'white', // szöveg fehér
                                padding: '5px 10px',
                                boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
                            }}
                        >
                            <MenuItem onClick={() => handleLanguageChange('en')} sx={{ display: 'flex', alignItems: 'center' }}>
                                <EnglishFlag sx={{ marginRight: '8px' }} /> English
                            </MenuItem>
                            <MenuItem onClick={() => handleLanguageChange('hu')} sx={{ display: 'flex', alignItems: 'center' }}>
                                <HungaryFlag sx={{ marginRight: '8px' }} /> Magyar
                            </MenuItem>
                            <MenuItem onClick={() => handleLanguageChange('ro')} sx={{ display: 'flex', alignItems: 'center' }}>
                                <RomaniaFlag sx={{ marginRight: '8px' }} /> Română
                            </MenuItem>
                        </Box>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default MenuBar;
