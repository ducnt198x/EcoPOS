import React, { useState, useMemo } from 'react';
import { BarChart, Bar, ResponsiveContainer, Cell, XAxis, Tooltip, YAxis, CartesianGrid } from 'recharts';
import { analyzeRevenueData } from '../services/geminiService';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageContext';

const Reports: React.FC = () => {
  const { orders, taxRate: globalTaxRate } = useData();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'revenue' | 'expenses'>('revenue');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [taxRate, setTaxRate] = useState<number>(globalTaxRate);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const filterOptions = [
    { id: 'day', label: t('reports.today') },
    { id: 'week', label: t('reports.week') },
    { id: 'month', label: t('reports.month') },
    { id: 'year', label: t('reports.year') },
  ];

  // --- Real Data Aggregation ---

  // 1. Filter Orders based on Time Selection
  const filteredOrders = useMemo(() => {
      const now = new Date();
      return orders.filter(order => {
          if (order.status !== 'completed') return false; // Only counted completed orders
          const orderDate = new Date(order.date);
          
          switch(timeFilter) {
              case 'day':
                  return orderDate.toDateString() === now.toDateString();
              case 'week':
                  const oneWeekAgo = new Date();
                  oneWeekAgo.setDate(now.getDate() - 7);
                  return orderDate >= oneWeekAgo && orderDate <= now;
              case 'month':
                  return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
              case 'year':
                  return orderDate.getFullYear() === now.getFullYear();
              default:
                  return true;
          }
      });
  }, [orders, timeFilter]);

  // 2. Aggregate Data for Chart
  const revenueData = useMemo(() => {
      const dataMap = new Map<string, number>();
      const now = new Date();

      // Initialize keys based on filter to ensure continuous axis
      if (timeFilter === 'day') {
          for (let i = 8; i <= 22; i++) { // 8 AM to 10 PM
              dataMap.set(`${i}:00`, 0);
          }
      } else if (timeFilter === 'week') {
          for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(now.getDate() - i);
              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
              dataMap.set(dayName, 0);
          }
      } else if (timeFilter === 'month') {
           // Group by Weeks (1-4)
           for (let i = 1; i <= 5; i++) dataMap.set(`Week ${i}`, 0);
      } else if (timeFilter === 'year') {
           const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
           months.forEach(m => dataMap.set(m, 0));
      }

      // Populate Data
      filteredOrders.forEach(order => {
          const d = new Date(order.date);
          let key = '';

          if (timeFilter === 'day') {
              const hour = d.getHours();
              if (hour >= 8 && hour <= 22) key = `${hour}:00`;
          } else if (timeFilter === 'week') {
              key = d.toLocaleDateString('en-US', { weekday: 'short' });
          } else if (timeFilter === 'month') {
              const day = d.getDate();
              const weekNum = Math.ceil(day / 7);
              key = `Week ${weekNum}`;
          } else if (timeFilter === 'year') {
              key = d.toLocaleDateString('en-US', { month: 'short' });
          }

          if (key && dataMap.has(key)) {
              dataMap.set(key, (dataMap.get(key) || 0) + order.total);
          }
      });

      return Array.from(dataMap.entries()).map(([label, amount]) => ({ label, amount }));
  }, [filteredOrders, timeFilter]);

  const totalRevenue = filteredOrders.reduce((acc, curr) => acc + curr.total, 0);
  const calculatedTax = totalRevenue * (taxRate / 100);
  const previousPeriodRevenue = totalRevenue * 0.85; // Simulated previous period for comparison

  // --- Expenses (Simulated based on Revenue) ---
  // In a real app, this would query an Expenses table.
  // Here we assume COGS is ~35% of revenue, Labor ~25%, Rent fixed, Utilities fixed.
  const expenseCategories = useMemo(() => {
      const cogs = totalRevenue * 0.35;
      const labor = Math.max(2000000, totalRevenue * 0.25); // Min base labor
      const rent = timeFilter === 'year' ? 120000000 : timeFilter === 'month' ? 10000000 : 2500000;
      const utilities = timeFilter === 'year' ? 24000000 : timeFilter === 'month' ? 2000000 : 500000;
      
      const totalExp = cogs + labor + rent + utilities;

      return [
        { name: 'Materials (COGS)', amount: cogs, percentage: Math.round((cogs / totalExp) * 100) || 0, color: '#13ec80', icon: 'restaurant' },
        { name: 'Labor Cost', amount: labor, percentage: Math.round((labor / totalExp) * 100) || 0, color: '#3b82f6', icon: 'groups' },
        { name: 'Rent', amount: rent, percentage: Math.round((rent / totalExp) * 100) || 0, color: '#f59e0b', icon: 'storefront' },
        { name: 'Utilities', amount: utilities, percentage: Math.round((utilities / totalExp) * 100) || 0, color: '#ec4899', icon: 'bolt' },
      ];
  }, [totalRevenue, timeFilter]);

  const totalExpenses = expenseCategories.reduce((acc, curr) => acc + curr.amount, 0);

  const handleAnalyze = async () => {
    setLoadingInsights(true);
    const dataForAI = {
        period: timeFilter,
        totalRevenue,
        totalExpenses,
        revenueTrend: revenueData,
        topExpenses: expenseCategories.map(e => ({ name: e.name, amount: e.amount }))
    };
    
    const result = await analyzeRevenueData(dataForAI);
    setInsights(result);
    setLoadingInsights(false);
  };

  // Sort recent transactions by date desc
  const recentTransactions = [...filteredOrders]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

  return (
    <div className="flex flex-col h-full w-full bg-background-light dark:bg-background-dark overflow-y-auto">
       <header className="sticky top-0 z-40 bg-background-light dark:bg-background-dark p-5 pt-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col">
             <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('reports.dashboard')}</span>
             <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">{t('reports.title')}</h2>
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto">
             <div className="flex bg-white dark:bg-card-dark rounded-xl p-1 border border-gray-200 dark:border-white/10">
                 <button 
                    onClick={() => setActiveTab('revenue')} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'revenue' ? 'bg-primary text-background-dark shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
                 >
                    {t('reports.revenue')}
                 </button>
                 <button 
                    onClick={() => setActiveTab('expenses')} 
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'expenses' ? 'bg-primary text-background-dark shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
                 >
                    {t('reports.expenses')}
                 </button>
             </div>
             <button 
                onClick={handleAnalyze} 
                disabled={loadingInsights}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
             >
                <span className={`material-symbols-outlined text-[18px] ${loadingInsights ? 'animate-spin' : ''}`}>auto_awesome</span>
                {loadingInsights ? t('reports.analyzing') : t('reports.ai_insights')}
             </button>
          </div>
       </header>

       {/* Insight Modal/Card */}
       {insights && (
           <div className="mx-5 mb-5 p-5 bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-2xl relative animate-in fade-in slide-in-from-top-4">
               <button onClick={() => setInsights(null)} className="absolute top-3 right-3 text-primary hover:text-primary-dark p-1 rounded-full hover:bg-primary/10 transition-colors"><span className="material-symbols-outlined text-lg">close</span></button>
               <h3 className="text-primary font-bold text-sm mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-lg">auto_awesome</span> Gemini Analysis</h3>
               <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                   {insights}
               </div>
           </div>
       )}

       {/* Filters Row */}
       <div className="px-5 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Time Filter Chips */}
          <div className="flex gap-2 p-1 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-white/5 w-fit overflow-x-auto no-scrollbar">
             {filterOptions.map((option) => (
                 <button 
                    key={option.id}
                    onClick={() => setTimeFilter(option.id as any)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        timeFilter === option.id 
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                 >
                    {option.label}
                 </button>
             ))}
          </div>

          {/* Tax Rate Input */}
          {activeTab === 'revenue' && (
              <div className="flex items-center gap-3 bg-white dark:bg-card-dark px-4 py-2 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm ml-auto sm:ml-0">
                 <div className="p-1.5 rounded-md bg-gray-100 dark:bg-white/10 text-slate-500 dark:text-slate-300">
                    <span className="material-symbols-outlined text-[18px]">percent</span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{t('settings.tax')}</span>
                    <div className="flex items-center gap-1">
                        <input 
                            type="number" 
                            min="0"
                            max="100"
                            value={taxRate}
                            onChange={(e) => setTaxRate(Number(e.target.value))}
                            className="w-12 p-0 bg-transparent text-sm font-bold text-slate-900 dark:text-white border-none focus:ring-0 text-right"
                        />
                        <span className="text-sm font-bold text-slate-900 dark:text-white">%</span>
                    </div>
                 </div>
              </div>
          )}
       </div>

       {activeTab === 'revenue' ? (
           <>
               <div className="flex flex-col gap-4 px-5 pb-24">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Hero Card */}
                      <div className="col-span-1 md:col-span-2 p-6 rounded-2xl bg-white dark:bg-card-dark shadow-sm ring-1 ring-slate-900/5 dark:ring-white/5 relative overflow-hidden group">
                         <div className="absolute -right-10 -top-10 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-500"></div>
                         <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="flex items-center gap-2">
                               <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary">
                                  <span className="material-symbols-outlined text-xl">payments</span>
                               </div>
                               <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wide">{t('reports.gross_revenue')}</p>
                            </div>
                            <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                               <span className="material-symbols-outlined text-sm font-bold">trending_up</span>
                               <p className="text-xs font-bold">+15%</p>
                            </div>
                         </div>
                         <p className="text-slate-900 dark:text-white text-5xl font-black tracking-tight mb-2 relative z-10">
                            {totalRevenue.toLocaleString()} ₫
                         </p>
                         <div className="flex flex-wrap items-center gap-x-4 gap-y-1 relative z-10 mt-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                                <p className="text-slate-400 text-xs font-medium">{t('reports.prev')}: {previousPeriodRevenue.toLocaleString()} ₫</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                                <p className="text-slate-400 text-xs font-medium">{t('pos.tax')}: {calculatedTax.toLocaleString()} ₫</p>
                            </div>
                         </div>
                      </div>

                      {/* Orders Count Card */}
                      <div className="col-span-1 p-6 rounded-2xl bg-white dark:bg-card-dark shadow-sm ring-1 ring-slate-900/5 dark:ring-white/5 relative overflow-hidden">
                         <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
                         <div className="flex items-center gap-2 mb-4">
                             <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                <span className="material-symbols-outlined text-xl">receipt_long</span>
                             </div>
                             <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wide">{t('reports.total_orders')}</p>
                         </div>
                         <p className="text-slate-900 dark:text-white text-4xl font-black tracking-tight mb-1 relative z-10">
                            {filteredOrders.length}
                         </p>
                         <p className="text-slate-400 text-xs mt-2">Avg. {(totalRevenue / (filteredOrders.length || 1)).toLocaleString()} ₫ / order</p>
                      </div>
                  </div>

                  {/* Chart */}
                  <div className="rounded-2xl bg-white dark:bg-card-dark p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/5">
                      <div className="flex justify-between items-center mb-6">
                         <div>
                            <p className="text-slate-900 dark:text-white text-lg font-bold">{t('reports.analytics')}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 capitalize">Period: {timeFilter}</p>
                         </div>
                      </div>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                                <XAxis 
                                    dataKey="label" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} 
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    tickFormatter={(value) => `${value / 1000}k`}
                                />
                                <Tooltip 
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    formatter={(value: number) => [`${value.toLocaleString()} ₫`, 'Revenue']}
                                />
                                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                    {revenueData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === revenueData.length - 1 ? '#13ec80' : '#475569'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                      </div>
                  </div>

                  {/* Transactions */}
                  <div className="flex flex-col gap-4">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary">history</span>
                          {t('reports.recent_transactions')}
                      </h3>
                      {recentTransactions.length > 0 ? (
                          recentTransactions.map(order => (
                            <div key={order.id} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-card-dark ring-1 ring-slate-900/5 dark:ring-white/5 hover:ring-primary/30 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${order.orderType === 'takeaway' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                                        <span className="material-symbols-outlined text-xl">{order.orderType === 'takeaway' ? 'shopping_bag' : 'restaurant'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{order.table !== 'Unknown' ? `Table ${order.table}` : order.customerName}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • #{order.id}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{order.total.toLocaleString()} ₫</p>
                                    <p className="text-[10px] text-emerald-500 font-bold uppercase">{order.paymentMethod}</p>
                                </div>
                            </div>
                          ))
                      ) : (
                          <div className="text-center p-8 text-gray-400 bg-white dark:bg-card-dark rounded-xl">
                              <p>No transactions found for this period.</p>
                          </div>
                      )}
                  </div>
               </div>
           </>
       ) : (
           <div className="flex flex-col gap-6 px-5 pb-24">
               {/* Expense Overview */}
               <section className="bg-white dark:bg-card-dark rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5">
                    <p className="text-slate-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wide">{t('reports.estimated_expenses')} ({timeFilter})</p>
                    <p className="text-4xl font-black tracking-tight text-slate-900 dark:text-white mt-1">{totalExpenses.toLocaleString()} ₫</p>
                    <p className="text-xs text-slate-400 mt-2 italic">*Expenses are estimated based on revenue percentages and fixed costs for demo purposes.</p>
               </section>

               {/* Chart Donut Equivalent (CSS) */}
               <section className="flex flex-col items-center justify-center py-6 bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-white/5">
                   <div className="relative w-56 h-56 rounded-full flex items-center justify-center" 
                        style={{ 
                            background: `conic-gradient(
                                ${expenseCategories[0].color} 0% ${expenseCategories[0].percentage}%, 
                                ${expenseCategories[1].color} ${expenseCategories[0].percentage}% ${expenseCategories[0].percentage + expenseCategories[1].percentage}%, 
                                ${expenseCategories[2].color} ${expenseCategories[0].percentage + expenseCategories[1].percentage}% ${expenseCategories[0].percentage + expenseCategories[1].percentage + expenseCategories[2].percentage}%, 
                                ${expenseCategories[3].color} ${expenseCategories[0].percentage + expenseCategories[1].percentage + expenseCategories[2].percentage}% 100%
                            )` 
                        }}>
                       <div className="absolute inset-0 m-6 bg-white dark:bg-card-dark rounded-full flex flex-col items-center justify-center z-10">
                            <p className="text-xs text-slate-500 dark:text-gray-400 font-bold uppercase">{t('reports.net_profit')}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{(totalRevenue - totalExpenses).toLocaleString()}</p>
                            <p className="text-xs font-bold text-emerald-500">{t('reports.margin')}: {totalRevenue > 0 ? Math.round(((totalRevenue - totalExpenses)/totalRevenue)*100) : 0}%</p>
                       </div>
                   </div>
               </section>

               <div className="flex flex-col gap-3">
                   {expenseCategories.map((cat, idx) => (
                       <div key={idx} className="group flex flex-col gap-2 p-4 rounded-xl bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 hover:border-primary/20 transition-all">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                                        <span className="material-symbols-outlined">{cat.icon}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{cat.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-gray-400">{cat.percentage}% of total expenses</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{cat.amount.toLocaleString()} ₫</p>
                                    <div className="w-20 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden mt-1 ml-auto">
                                        <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}></div>
                                    </div>
                                </div>
                            </div>
                       </div>
                   ))}
               </div>
           </div>
       )}
    </div>
  );
};

export default Reports;