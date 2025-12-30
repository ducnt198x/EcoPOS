import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-full w-full bg-background-light dark:bg-background-dark items-center justify-center p-6">
      <div className="w-full max-w-4xl animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{t('admin.title')}</h1>
            <p className="text-slate-500 dark:text-gray-400">{t('admin.welcome')}, {user?.name}.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
            {/* Option 1: Main App */}
            <div 
                onClick={() => navigate('/pos')}
                className="group relative bg-white dark:bg-surface-dark p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all cursor-pointer overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all"></div>
                
                <div className="relative z-10 flex flex-col items-center text-center h-full justify-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-4xl text-white">storefront</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('admin.launch_pos')}</h2>
                        <p className="text-slate-500 dark:text-gray-400">{t('admin.launch_desc')}</p>
                    </div>
                    <button className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white font-bold group-hover:bg-primary group-hover:text-background-dark transition-colors">
                        {t('admin.enter_app')}
                    </button>
                </div>
            </div>

            {/* Option 2: Create User */}
            <div 
                onClick={() => navigate('/admin/create-user')}
                className="group relative bg-white dark:bg-surface-dark p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all cursor-pointer overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all"></div>
                
                <div className="relative z-10 flex flex-col items-center text-center h-full justify-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-4xl text-white">person_add</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('admin.create_user')}</h2>
                        <p className="text-slate-500 dark:text-gray-400">{t('admin.create_desc')}</p>
                    </div>
                    <button className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white font-bold group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        {t('admin.create_btn')}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;