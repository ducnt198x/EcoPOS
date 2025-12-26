
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePrinter } from '../contexts/PrinterContext';

const Settings: React.FC = () => {
  const { user, logout, updateProfile, updatePassword } = useAuth();
  const { taxRate, updateTaxRate } = useData();
  const { language, setLanguage, t } = useLanguage();
  const { connectPrinter, disconnectPrinter, isConnected, device, error: printerError, printTest } = usePrinter();

  // Local UI State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  
  const [currency, setCurrency] = useState(() => localStorage.getItem('eco_currency') || 'vnd');
  
  const [notifications, setNotifications] = useState({
      orders: true,
      stock: true,
      sound: false
  });

  const [localTaxRate, setLocalTaxRate] = useState(taxRate.toString());
  const [isSavingTax, setIsSavingTax] = useState(false);

  // Edit Profile State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Sync theme changes
  useEffect(() => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
      localStorage.setItem('eco_currency', currency);
  }, [currency]);

  // Handle Tax Rate Save
  const handleSaveTax = async () => {
      const rate = parseFloat(localTaxRate);
      if (!isNaN(rate) && rate >= 0 && rate <= 100) {
          setIsSavingTax(true);
          await updateTaxRate(rate);
          setIsSavingTax(false);
      } else {
          setLocalTaxRate(taxRate.toString()); // Revert if invalid
      }
  };

  // Profile Handlers
  const handleOpenEditProfile = () => {
      if (user) {
          setEditName(user.name);
          setEditAvatar(user.avatar || '');
          setShowEditProfileModal(true);
      }
  };

  const handleRandomizeAvatar = () => {
      const randomSeed = Math.random().toString(36).substring(7);
      setEditAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}`);
  };

  const handleAvatarClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setEditAvatar(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSaveProfile = async () => {
      setIsSavingProfile(true);
      try {
          await updateProfile({ name: editName, avatar: editAvatar });
          setShowEditProfileModal(false);
      } catch (error) {
          console.error("Failed to update profile", error);
          alert("Failed to update profile");
      } finally {
          setIsSavingProfile(false);
      }
  };

  // Password Handlers
  const handleOpenPasswordModal = () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);
      setShowPasswordModal(true);
  };

  const handleUpdatePassword = async () => {
      if (newPassword.length < 6) {
          setPasswordError("Password must be at least 6 characters");
          return;
      }
      if (newPassword !== confirmPassword) {
          setPasswordError(t('settings.password_match_error'));
          return;
      }
      if (!currentPassword) {
          setPasswordError(t('settings.password_old_error'));
          return;
      }

      setIsSavingPassword(true);
      setPasswordError(null);

      try {
          const { error } = await updatePassword(newPassword, currentPassword);
          if (error) {
              if (error.message.includes("password")) {
                  throw new Error(t('settings.password_old_error'));
              }
              throw error;
          }
          setPasswordSuccess(true);
          setTimeout(() => {
              setShowPasswordModal(false);
          }, 1500);
      } catch (error: any) {
          setPasswordError(error.message || "Failed to update password");
      } finally {
          setIsSavingPassword(false);
      }
  };

  return (
    <div className="flex flex-col h-full w-full bg-background-light dark:bg-background-dark overflow-y-auto relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-8 pb-4 z-10 sticky top-0 bg-background-light dark:bg-background-dark">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('settings.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400">{t('settings.subtitle')}</p>
        </div>
      </header>

      <div className="px-6 pb-24 max-w-4xl mx-auto w-full space-y-6">
          
          {/* Profile Card */}
          <section className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-primary to-emerald-600">
                      <img src={user?.avatar} alt={user?.name} className="w-full h-full rounded-full object-cover border-4 border-white dark:border-surface-dark bg-white" />
                  </div>
                  <button 
                    onClick={handleOpenEditProfile}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-white dark:bg-surface-dark rounded-full flex items-center justify-center shadow-md cursor-pointer hover:text-primary transition-colors border border-gray-100 dark:border-white/10"
                  >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
              </div>
              <div className="text-center sm:text-left flex-1">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user?.name}</h2>
                  <p className="text-sm text-slate-500 dark:text-gray-400 mb-2">{user?.email}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      user?.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300' 
                      : user?.role === 'manager'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
                      : 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                  }`}>
                      {t(`role.${user?.role}`)}
                  </span>
              </div>
              <button 
                  onClick={() => logout()}
                  className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
              >
                  {t('nav.logout')}
              </button>
          </section>

          {/* Hardware / Printer */}
          <section className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">print</span>
                      Hardware
                  </h3>
              </div>
              <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isConnected ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}>
                              <span className="material-symbols-outlined text-2xl">usb</span>
                          </div>
                          <div>
                              <p className="font-bold text-slate-900 dark:text-white">USB Thermal Printer</p>
                              <p className="text-xs text-slate-500 dark:text-gray-400">
                                  {isConnected 
                                    ? `Connected: ${device?.productName || 'Unknown Device'}`
                                    : 'Not connected'}
                              </p>
                              {printerError && <p className="text-xs text-red-500 mt-1 font-bold">{printerError}</p>}
                          </div>
                      </div>
                      <div className="flex gap-2">
                          {isConnected && (
                              <button 
                                onClick={printTest}
                                className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-white font-bold text-sm hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                              >
                                Test Print
                              </button>
                          )}
                          <button 
                              onClick={isConnected ? disconnectPrinter : connectPrinter}
                              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                                  isConnected 
                                  ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100'
                                  : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90'
                              }`}
                          >
                              {isConnected ? 'Disconnect' : 'Connect'}
                          </button>
                      </div>
                  </div>
                  
                  {/* Troubleshooting Tip */}
                  {!isConnected && (
                      <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl flex items-start gap-3">
                          <span className="material-symbols-outlined text-blue-500 text-xl mt-0.5">info</span>
                          <div className="text-xs text-blue-800 dark:text-blue-300">
                              <p className="font-bold mb-1">Cannot connect on Windows?</p>
                              <p>Standard printer drivers block WebUSB. You may need to use a tool like <strong>Zadig</strong> to replace the driver with <strong>WinUSB</strong> for the browser to access it directly.</p>
                          </div>
                      </div>
                  )}
              </div>
          </section>

          {/* General Settings */}
          <section className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">tune</span>
                      {t('settings.general')}
                  </h3>
              </div>
              
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {/* Theme Toggle */}
                  <div className="px-6 py-4 flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.appearance')}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-400">{t('settings.appearance_desc')}</p>
                      </div>
                      <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-lg">
                          <button 
                              onClick={() => setTheme('light')}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${theme === 'light' ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}
                          >
                              <span className="material-symbols-outlined text-[16px]">light_mode</span>
                              {t('settings.light')}
                          </button>
                          <button 
                              onClick={() => setTheme('dark')}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${theme === 'dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}
                          >
                              <span className="material-symbols-outlined text-[16px]">dark_mode</span>
                              {t('settings.dark')}
                          </button>
                      </div>
                  </div>

                  {/* Language */}
                  <div className="px-6 py-4 flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.language')}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-400">{t('settings.language_desc')}</p>
                      </div>
                      <select 
                          value={language}
                          onChange={(e) => setLanguage(e.target.value as any)}
                          className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white text-sm rounded-lg focus:ring-primary focus:border-primary block w-40 p-2.5"
                      >
                          <option value="en">English (US)</option>
                          <option value="vi">Tiếng Việt</option>
                          <option value="fr">Français</option>
                      </select>
                  </div>

                   {/* Currency */}
                   <div className="px-6 py-4 flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.currency')}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-400">{t('settings.currency_desc')}</p>
                      </div>
                      <select 
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white text-sm rounded-lg focus:ring-primary focus:border-primary block w-40 p-2.5"
                      >
                          <option value="vnd">VND (₫)</option>
                          <option value="usd">USD ($)</option>
                          <option value="eur">EUR (€)</option>
                      </select>
                  </div>
              </div>
          </section>

          {/* Security Settings */}
          <section className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">security</span>
                      {t('settings.security')}
                  </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                  <div className="px-6 py-4 flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.change_password')}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-400">{t('settings.change_password_desc')}</p>
                      </div>
                      <button 
                          onClick={handleOpenPasswordModal}
                          className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-slate-700 dark:text-white font-bold text-xs transition-colors border border-gray-200 dark:border-white/10"
                      >
                          {t('inventory.update')}
                      </button>
                  </div>
              </div>
          </section>

          {/* Business Settings (Admin/Manager) */}
          {['admin', 'manager'].includes(user?.role || '') && (
              <section className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary">store</span>
                          {t('settings.business')}
                      </h3>
                  </div>
                  
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                      {/* Tax Rate */}
                      <div className="px-6 py-4 flex items-center justify-between">
                          <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.tax')}</p>
                              <p className="text-xs text-slate-500 dark:text-gray-400">{t('settings.tax_desc')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                              {user?.role === 'admin' ? (
                                  <div className="flex gap-2">
                                      <input 
                                          type="number" 
                                          min="0"
                                          max="100"
                                          value={localTaxRate}
                                          onChange={(e) => setLocalTaxRate(e.target.value)}
                                          className="w-20 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 text-center font-bold"
                                      />
                                      <button 
                                          onClick={handleSaveTax}
                                          disabled={isSavingTax || localTaxRate === taxRate.toString()}
                                          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                                            localTaxRate !== taxRate.toString() 
                                            ? 'bg-primary text-background-dark hover:opacity-90 shadow-sm' 
                                            : 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-default'
                                          }`}
                                      >
                                          {isSavingTax ? '...' : t('settings.save')}
                                      </button>
                                  </div>
                              ) : (
                                  <span className="font-bold text-slate-900 dark:text-white bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-lg">{taxRate}%</span>
                              )}
                          </div>
                      </div>
                  </div>
              </section>
          )}

          {/* Notifications */}
          <section className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">notifications</span>
                      {t('settings.notifications')}
                  </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                  <div className="px-6 py-4 flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.order_alerts')}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-400">{t('settings.order_alerts_desc')}</p>
                      </div>
                      <button 
                          onClick={() => setNotifications({...notifications, orders: !notifications.orders})}
                          className={`w-12 h-6 rounded-full transition-colors relative ${notifications.orders ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'}`}
                      >
                          <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${notifications.orders ? 'translate-x-6' : ''}`}></span>
                      </button>
                  </div>
                  <div className="px-6 py-4 flex items-center justify-between">
                      <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.stock_alerts')}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-400">{t('settings.stock_alerts_desc')}</p>
                      </div>
                      <button 
                          onClick={() => setNotifications({...notifications, stock: !notifications.stock})}
                          className={`w-12 h-6 rounded-full transition-colors relative ${notifications.stock ? 'bg-primary' : 'bg-gray-200 dark:bg-white/10'}`}
                      >
                          <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${notifications.stock ? 'translate-x-6' : ''}`}></span>
                      </button>
                  </div>
              </div>
          </section>

          {/* About */}
          <section className="text-center py-6">
              <p className="text-sm text-slate-400 dark:text-gray-500 font-medium">EcoPOS v1.0.3</p>
              <p className="text-xs text-slate-300 dark:text-gray-600 mt-1">© 2024 EcoPOS Systems. All rights reserved.</p>
          </section>

      </div>

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/5 animate-in zoom-in-95 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings.edit_profile')}</h3>
                      <button onClick={() => setShowEditProfileModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>

                  <div className="flex flex-col items-center mb-6">
                      <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-primary to-emerald-600 mb-4">
                              <img src={editAvatar} alt="Preview" className="w-full h-full rounded-full object-cover border-4 border-white dark:border-surface-dark bg-white" />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity mb-4 mx-1 mt-1 w-24 h-24">
                              <span className="material-symbols-outlined text-white text-2xl">upload</span>
                          </div>
                      </div>
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleFileChange}
                      />
                      <button 
                          onClick={handleRandomizeAvatar}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 text-slate-700 dark:text-white font-bold text-xs hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                      >
                          <span className="material-symbols-outlined text-[16px]">casino</span>
                          {t('settings.randomize')}
                      </button>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('login.fullname')}</label>
                          <input 
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('settings.avatar_url')}</label>
                          <input 
                              type="text"
                              value={editAvatar}
                              onChange={(e) => setEditAvatar(e.target.value)}
                              className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-xs"
                              placeholder={t('settings.avatar_hint')}
                          />
                      </div>
                  </div>

                  <div className="mt-8 flex gap-3">
                      <button 
                          onClick={() => setShowEditProfileModal(false)}
                          className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-white/5 font-bold text-slate-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                      >
                          {t('inventory.cancel')}
                      </button>
                      <button 
                          onClick={handleSaveProfile}
                          disabled={isSavingProfile}
                          className="flex-1 h-12 rounded-xl bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-70"
                      >
                          {isSavingProfile ? 'Saving...' : t('settings.save')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-white/5 animate-in zoom-in-95 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings.change_password')}</h3>
                      <button onClick={() => setShowPasswordModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>

                  {passwordSuccess && (
                      <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
                          <span className="material-symbols-outlined">check_circle</span>
                          {t('settings.password_updated')}
                      </div>
                  )}

                  {passwordError && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                          <span className="material-symbols-outlined">error</span>
                          {passwordError}
                      </div>
                  )}

                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('settings.current_password')}</label>
                          <input 
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                              placeholder="••••••••"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('settings.new_password')}</label>
                          <input 
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                              placeholder="••••••••"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('settings.confirm_password')}</label>
                          <input 
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full h-11 px-4 rounded-xl bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                              placeholder="••••••••"
                          />
                      </div>
                  </div>

                  <div className="mt-8 flex gap-3">
                      <button 
                          onClick={() => setShowPasswordModal(false)}
                          className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-white/5 font-bold text-slate-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                      >
                          {t('inventory.cancel')}
                      </button>
                      <button 
                          onClick={handleUpdatePassword}
                          disabled={isSavingPassword || !newPassword || !confirmPassword || !currentPassword}
                          className="flex-1 h-12 rounded-xl bg-primary text-background-dark font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                          {isSavingPassword ? '...' : t('settings.save')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;
