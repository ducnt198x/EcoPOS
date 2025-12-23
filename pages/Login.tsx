import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Role } from '../types';
import { supabase } from '../services/supabase';

const Login: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  // Role defaults to cashier for public sign-ups
  const role: Role = 'cashier'; 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    setLoading(true);

    try {
        if (isSignUp) {
            // Public sign-ups are always 'cashier'
            const { data, error } = await signUp(email, password, name, role);
            if (error) throw error;
            
            // Check if email confirmation is required (no session returned)
            if (data && !data.session && data.user) {
                 setAlert({ type: 'success', message: "Account created! Please check your email to confirm registration." });
                 setIsSignUp(false); // Switch back to login mode
                 // Clear form fields
                 setEmail('');
                 setPassword('');
                 setName('');
                 return;
            }

            // If auto-confirm is on, sign in immediately to check next steps
            const { data: signInData, error: signInError } = await signIn(email, password);
            if (signInError) throw signInError;
            
            // New cashiers go to tables
            navigate('/tables');
        } else {
            const { data, error } = await signIn(email, password);
            if (error) throw error;

            // Determine routing based on role
            if (data?.user && supabase) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();
                
                if (profile?.role === 'admin') {
                    navigate('/admin-dashboard');
                } else {
                    navigate('/tables');
                }
            } else {
                navigate('/tables');
            }
        }
    } catch (err: any) {
        console.error(err);
        // Specific handling for Email not confirmed error
        if (err.message && err.message.includes("Email not confirmed")) {
            setAlert({ type: 'error', message: "Email not confirmed. Please check your inbox." });
        } else if (err.message && err.message.includes("Invalid login credentials")) {
            setAlert({ type: 'error', message: "Invalid email or password. Please try again." });
        } else {
            setAlert({ type: 'error', message: err.message || "An error occurred" });
        }
    } finally {
        setLoading(false);
    }
  };

  const toggleMode = () => {
      setIsSignUp(!isSignUp);
      setAlert(null);
      setPassword(''); // Clear password on switch for security
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background-light dark:bg-background-dark p-4 relative">
      
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-50">
          <div className="relative group">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="appearance-none bg-white/90 dark:bg-black/50 backdrop-blur-md border border-gray-200 dark:border-white/10 text-slate-700 dark:text-white py-2.5 pl-4 pr-10 rounded-xl shadow-lg font-bold text-sm cursor-pointer focus:ring-2 focus:ring-primary outline-none transition-all hover:bg-white dark:hover:bg-black/70"
              >
                <option value="en">🇺🇸 English</option>
                <option value="vi">🇻🇳 Tiếng Việt</option>
                <option value="fr">🇫🇷 Français</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 dark:text-gray-400 group-hover:text-primary transition-colors">
                 <span className="material-symbols-outlined text-[20px]">language</span>
              </div>
          </div>
      </div>

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-0 bg-white dark:bg-surface-dark rounded-3xl shadow-2xl overflow-hidden ring-1 ring-slate-200 dark:ring-white/5 min-h-[600px]">
        
        {/* Left Side - Brand */}
        <div className="hidden md:flex flex-col justify-center p-12 bg-gradient-to-br from-[#162e22] to-[#0f1f17] relative overflow-hidden text-white">
           <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1559339352-11d035aa65de?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80')] opacity-20 bg-cover bg-center mix-blend-overlay"></div>
           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-primary rounded-xl">
                   <span className="material-symbols-outlined text-background-dark text-3xl">eco</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight">EcoPOS</h1>
              </div>
              <p className="text-gray-300 text-lg leading-relaxed mb-8">
                {t('login.brand_subtitle')}
              </p>
              <div className="flex flex-col gap-4 mt-8">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-primary"><span className="material-symbols-outlined">table_restaurant</span></div>
                      <span className="text-sm font-medium text-gray-200">{t('login.feature_floor')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-primary"><span className="material-symbols-outlined">inventory_2</span></div>
                      <span className="text-sm font-medium text-gray-200">{t('login.feature_inventory')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-primary"><span className="material-symbols-outlined">bar_chart</span></div>
                      <span className="text-sm font-medium text-gray-200">{t('login.feature_analytics')}</span>
                  </div>
              </div>
           </div>
        </div>

        {/* Right Side - Form */}
        <div className="flex flex-col justify-center p-8 md:p-12 relative">
           <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{isSignUp ? t('login.create_account') : t('login.welcome')}</h2>
              <p className="text-slate-500 dark:text-gray-400">
                  {isSignUp ? t('login.create_subtitle') : t('login.subtitle')}
              </p>
           </div>

           {alert && (
               <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 relative ${
                   alert.type === 'success'
                   ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                   : 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400'
               }`}>
                   <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">{alert.type === 'success' ? 'check_circle' : 'error'}</span>
                   <span className="flex-1">{alert.message}</span>
                   <button onClick={() => setAlert(null)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                       <span className="material-symbols-outlined text-[18px]">close</span>
                   </button>
               </div>
           )}

           <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {isSignUp && (
                  <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('login.fullname')}</label>
                      <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                              <span className="material-symbols-outlined text-[20px]">person</span>
                          </div>
                          <input 
                              type="text" 
                              required 
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full h-12 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark pl-11 pr-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600"
                              placeholder="John Doe"
                          />
                      </div>
                  </div>
              )}

              <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('login.email')}</label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[20px]">mail</span>
                      </div>
                      <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-12 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark pl-11 pr-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600"
                        placeholder="name@example.com"
                      />
                  </div>
              </div>

              <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">{t('login.password')}</label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[20px]">lock</span>
                      </div>
                      <input 
                        type={showPassword ? "text" : "password"}
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-12 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark pl-11 pr-12 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600"
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
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="mt-4 w-full h-12 bg-primary hover:bg-primary-dark text-background-dark font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                 {loading && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                 {isSignUp ? t('login.create_account') : t('login.signin')}
              </button>
           </form>

           <div className="mt-8 text-center">
              <p className="text-sm text-slate-500 dark:text-gray-400">
                  {isSignUp ? t('login.already_have_account') : t('login.dont_have_account')}
                  <button 
                    onClick={toggleMode}
                    className="ml-2 font-bold text-primary hover:underline focus:outline-none"
                  >
                      {isSignUp ? t('login.signin') : t('login.signup')}
                  </button>
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Login;