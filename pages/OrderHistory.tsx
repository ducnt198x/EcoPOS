import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageContext';

const OrderHistory: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { orders } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  // Filtering Logic
  const filteredOrders = orders.filter(order => {
    // Search Filter
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.table.toLowerCase().includes(searchQuery.toLowerCase());

    // Date Filter
    let matchesDate = true;
    const orderDate = new Date(order.date);
    const today = new Date();
    
    if (dateFilter === 'today') {
        matchesDate = orderDate.toDateString() === today.toDateString();
    } else if (dateFilter === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        matchesDate = orderDate.toDateString() === yesterday.toDateString();
    } else if (dateFilter === 'week') {
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        matchesDate = orderDate >= lastWeek;
    }

    return matchesSearch && matchesDate;
  });

  const handleReorder = (orderId: string) => {
      // Logic would go here to repopulate cart
      navigate('/pos');
  };

  return (
    <div className="flex flex-col h-full w-full bg-background-light dark:bg-background-dark overflow-hidden relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-8 pb-4 z-10 sticky top-0 bg-background-light dark:bg-background-dark">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('history.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400">{t('history.subtitle')}</p>
        </div>
        <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-gray-50 transition-colors">
                <span className="material-symbols-outlined text-[20px]">file_download</span>
                <span className="text-sm font-medium">{t('history.export')}</span>
            </button>
        </div>
      </header>

      {/* Filters */}
      <div className="px-6 pb-4 shrink-0 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 h-12 rounded-xl bg-white dark:bg-surface-dark shadow-sm border border-slate-200 dark:border-none overflow-hidden group focus-within:ring-2 focus-within:ring-primary/50 transition-all">
           <div className="absolute left-0 top-0 h-full w-12 grid place-items-center text-slate-400 dark:text-gray-500">
              <span className="material-symbols-outlined">search</span>
           </div>
           <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-full w-full outline-none text-sm text-slate-700 dark:text-white pl-12 pr-4 bg-transparent placeholder-slate-400 dark:placeholder-gray-500 border-none focus:ring-0" 
              placeholder={t('history.search')} 
              type="text"
           />
        </div>

        {/* Date Filter */}
        <div className="relative min-w-[180px]">
            <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full appearance-none h-12 pl-4 pr-10 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-none text-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-primary/50 outline-none"
            >
                <option value="all">{t('history.all_time')}</option>
                <option value="today">{t('history.today')}</option>
                <option value="yesterday">{t('history.yesterday')}</option>
                <option value="week">{t('history.last_7_days')}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 dark:text-gray-400">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
            </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 space-y-4 no-scrollbar">
          {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <span className="material-symbols-outlined text-5xl mb-3 opacity-50">receipt_long</span>
                  <p>{t('history.no_orders')}</p>
              </div>
          ) : (
              filteredOrders.map(order => (
                <div key={order.id} className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-2xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
                    {/* Left Info */}
                    <div className="flex items-start gap-4 mb-4 sm:mb-0 w-full sm:w-auto">
                        <div className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'}`}>
                            <span className="material-symbols-outlined">{order.status === 'completed' ? 'check' : 'close'}</span>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">{order.id}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                                    {order.status}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                                {new Date(order.date).toLocaleDateString()} • {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-slate-400 mt-1 sm:hidden">
                                {order.customerName} • {order.table}
                            </p>
                        </div>
                    </div>

                    {/* Middle Info (Desktop) */}
                    <div className="hidden sm:flex flex-col flex-1 px-8">
                        <p className="font-semibold text-slate-800 dark:text-gray-200">{order.customerName}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">{order.table} • {order.paymentMethod}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[200px]">
                            {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6">
                        <div className="flex flex-col items-start sm:items-end">
                            <span className="text-lg font-bold text-slate-900 dark:text-white">{order.total.toLocaleString()} ₫</span>
                            <span className="text-xs text-slate-500 dark:text-gray-400">{order.items.length} {t('history.items')}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleReorder(order.id)}
                                title="Reorder Items"
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-background-dark transition-all active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[20px]">refresh</span>
                            </button>
                            <button title="View Details" className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                            </button>
                        </div>
                    </div>
                </div>
              ))
          )}
      </div>
    </div>
  );
};

export default OrderHistory;