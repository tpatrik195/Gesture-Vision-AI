import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Button, MenuItem, Box, IconButton, Drawer, List, ListItemButton, ListItemText } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { EnglishFlag } from '../pictures/englishFlag';
import { HungaryFlag } from '../pictures/hungaryFlag';
import { RomaniaFlag } from '../pictures/romaniaFlag';

const MenuBar = ({ menuItems }) => {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showBar, setShowBar] = useState(true);
    const [lastScroll, setLastScroll] = useState(0);
    const languageMenuRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    const handleToggle = () => setOpen(!open);

    const handleLanguageChange = (newLanguage) => {
        i18n.changeLanguage(newLanguage);
        setOpen(false);
    };

    const handleItemClick = (path) => {
        navigate(path);
        setMobileMenuOpen(false);
    };

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

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!open) {
                return;
            }
            if (languageMenuRef.current && !languageMenuRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [open]);

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
                <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center', flex: 1 }}>
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

                <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', flex: 1 }}>
                    <IconButton onClick={() => setMobileMenuOpen(true)} sx={{ color: 'white' }}>
                        <MenuIcon />
                    </IconButton>
                </Box>

                <Box ref={languageMenuRef} sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <LanguageIcon sx={{ cursor: 'pointer', color: 'white' }} onClick={handleToggle} />
                    {open && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 'calc(100% + 10px)',
                                right: 0,
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(6px)',
                                borderRadius: '5px',
                                zIndex: 1400,
                                color: 'white',
                                padding: '5px 10px',
                                minWidth: 170,
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

            <Drawer
                anchor="left"
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    '& .MuiDrawer-paper': {
                        width: 270,
                        backgroundColor: '#f3efe7',
                        color: '#3a241f',
                    },
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
                    <IconButton onClick={() => setMobileMenuOpen(false)} sx={{ color: '#3a241f' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>
                <List>
                    {menuItems.map((item, index) => (
                        <ListItemButton key={index} onClick={() => handleItemClick(item.path)}>
                            <ListItemText
                                primary={item.label}
                                primaryTypographyProps={{
                                    fontWeight: location.pathname === item.path ? 700 : 500,
                                    color: location.pathname === item.path ? '#1f5a3a' : '#3a241f',
                                }}
                            />
                        </ListItemButton>
                    ))}
                </List>
            </Drawer>
        </AppBar>
    );
};

export default MenuBar;
