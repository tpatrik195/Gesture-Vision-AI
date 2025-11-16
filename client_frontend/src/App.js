import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './i18n/i18n';
import MenuBar from './components/Menubar';
import HomePage from './pages/HomePage';
import PresentationPage from './pages/PresentationPage';
import PracticePage from './pages/PracticePage';
import SettingsPage from './pages/SettingsPage';
import GestureDetailPage from './pages/GestureDetailPage';

const App = () => {
  const { t } = useTranslation();

  const menuItems = [
    { label: t('menuBar.home'), path: '/' },
    { label: t('menuBar.presentation'), path: '/presentation' },
    { label: t('menuBar.practice'), path: '/practice' },
    { label: t('menuBar.settings'), path: '/settings' }
  ];

  return (
    <Router>
      <div>
        <MenuBar
          menuItems={menuItems}
          currentPath={window.location.pathname}
        />
        <div>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/presentation" element={<PresentationPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/practice/:gestureId" element={<GestureDetailPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
