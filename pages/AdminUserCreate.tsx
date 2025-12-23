import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Role } from '../types';

const AdminUserCreate: React.FC = () => {
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('manager');

  const generatePassword = () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
      let pass = "";
      for (let i = 0; i < 12; i++) {
          pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setPassword(pass);
      setShowPassword(true); // Show generated password immediately
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
        const { error } = await signUp(email, password, name, role);
        
        if (error) {
             throw error;
        }
        
        setMessage({ text: `Successfully created ${role} account for ${name}!`, type: 'success' });
        // Clear form
        setName('');
        setEmail('');
        setPassword('');
        setRole('manager');
        
    } catch (err: any) {
        let errorText = "Failed to create account.";

        // Handle stringified error objects if they leak through
        if (typeof err === 'object') {
             if (err.message) errorText = err.message;
             else if (err.error_description) errorText = err.error_description;
             // Fallback for code-based errors not caught upstream
             else if (err.code === '23503') errorText = "Database sync error. The email might be valid but profile creation failed.";
        } else if (typeof err === 'string') {
             errorText = err;
        }

        setMessage({ text: errorText, type: 'error' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background-light dark:bg-background-dark items-center justify-center p-6">
        {/* Back Button */}
        <div className="absolute top-6 left-6">
            <button 
                onClick={() => navigate('/admin-dashboard')}
                className="flex items-center gap-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors group"
            >
                <div className="w-10 h-10 rounded-full bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </div>
                <span className="font-bold">{t('user_create.back')}</span>
            </button>
        </div>

        <div className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-white/5 animate-in slide-in-from-bottom-10 duration-300">
            <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('user_create.title')}</h2>
                <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">{t('user_create.subtitle')}</p>
            </div>

            {message && (
               <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 text-sm ${
                   message.type === 'success'
                   ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                   : message.type === 'warning'
                   ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400'
                   : 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400'
               }`}>
                   <span className="material-symbols-outlined shrink-0">
                      {message.type === 'success' ? 'check_circle' : message.type === 'warning' ? 'warning' : 'error'}
                   </span>
                   <span>{message.text}</span>
               </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('user_create.fullname')}</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[20px]">person</span>
                        </div>
                        <input 
                            type="text" 
                            required 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full h-12 rounded-xl border border-slate-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 pl-11 pr-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600"
                            placeholder="Staff Name"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('user_create.email')}</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[20px]">mail</span>
                        </div>
                        <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-12 rounded-xl border border-slate-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 pl-11 pr-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600"
                            placeholder="staff@restaurant.com"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('user_create.password')}</label>
                    <div className="relative flex gap-2">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                <span className="material-symbols-outlined text-[20px]">lock</span>
                            </div>
                            <input 
                                type={showPassword ? "text" : "password"}
                                required 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-12 rounded-xl border border-slate-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 pl-11 pr-12 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600 font-mono"
                                placeholder="••••••••"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                        <button 
                            type="button" 
                            onClick={generatePassword}
                            className="px-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                            title="Generate Random Password"
                        >
                            <span className="material-symbols-outlined text-[20px]">casino</span>
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('user_create.role')}</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setRole('manager')}
                            className={`h-12 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                role === 'manager' 
                                ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                                : 'border-transparent bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10'
                            }`}
                        >
                            <span className="material-symbols-outlined">supervisor_account</span>
                            {t('role.manager')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setRole('admin')}
                            className={`h-12 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                role === 'admin' 
                                ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400' 
                                : 'border-transparent bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10'
                            }`}
                        >
                            <span className="material-symbols-outlined">shield_person</span>
                            {t('role.admin')}
                        </button>
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="mt-6 w-full h-14 bg-slate-900 dark:bg-white hover:opacity-90 text-white dark:text-slate-900 font-bold rounded-xl shadow-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? t('user_create.creating') : t('user_create.create')}
                </button>
            </form>
        </div>
    </div>
  );
};

export default AdminUserCreate;