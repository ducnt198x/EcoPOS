import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Role } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { t } = useLanguage();

  // Hide sidebar for checkout flows or specific modals if they were full pages or if not logged in
  const isFullScreen = location.pathname.includes('/checkout') || location.pathname === '/login';

  if (isFullScreen) {
    return <>{children}</>;
  }

  interface NavItem {
    path: string;
    icon: string;
    label: string;
    roles: Role[];
  }

  const navItems: NavItem[] = [
    { path: '/tables', icon: 'table_restaurant', label: t('nav.tables'), roles: ['admin', 'manager', 'cashier'] },
    { path: '/pos', icon: 'point_of_sale', label: t('nav.menu'), roles: ['admin', 'manager', 'cashier'] },
    { path: '/order-history', icon: 'receipt_long', label: t('nav.history'), roles: ['admin', 'manager'] },
    { path: '/inventory', icon: 'inventory_2', label: t('nav.inventory'), roles: ['admin', 'manager'] },
    { path: '/reports', icon: 'bar_chart', label: t('nav.reports'), roles: ['admin'] },
    { path: '/settings', icon: 'settings', label: t('nav.settings'), roles: ['admin', 'manager', 'cashier'] },
  ];

  const filteredNavItems = navItems.filter(item => hasPermission(item.roles));

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-20 items-center py-6 bg-white dark:bg-surface-dark border-r border-gray-200 dark:border-white/5 z-30">
        <div className="mb-8 p-2 bg-primary rounded-xl cursor-pointer shadow-lg shadow-primary/20" onClick={() => navigate('/')}>
           <span className="material-symbols-outlined text-background-dark text-2xl">eco</span>
        </div>
        
        <nav className="flex-1 flex flex-col gap-4 w-full px-2">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-gray-200'
                }`
              }
            >
              <span className={`material-symbols-outlined text-2xl mb-1 ${location.pathname === item.path ? 'filled' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4">
          <button 
            onClick={() => navigate('/settings')}
            className={`w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden border transition-all cursor-pointer ${
                location.pathname === '/settings' 
                ? 'border-primary ring-2 ring-primary/30' 
                : 'border-transparent hover:border-primary'
            }`}
            title={t('nav.settings')}
          >
             <img src={user?.avatar} alt="User" className="w-full h-full object-cover" />
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-white/5 pb-safe pt-2 px-4 flex justify-between items-center z-50 h-16">
        {filteredNavItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 transition-colors ${
                  isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
                }`
              }
            >
              <span className={`material-symbols-outlined text-2xl ${location.pathname === item.path ? 'filled' : ''}`}>
                  {item.icon}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
        ))}
         <button onClick={() => navigate('/settings')} className={`flex flex-col items-center gap-1 transition-colors ${location.pathname === '/settings' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
            <span className={`material-symbols-outlined text-2xl ${location.pathname === '/settings' ? 'filled' : ''}`}>settings</span>
            <span className="text-[10px] font-medium">{t('nav.settings')}</span>
         </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col h-full w-full">
        {children}
      </main>
    </div>
  );
};

export default Layout;