import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table } from '../types';

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Mock Data
  const tables: Table[] = [
    { id: 'T1', name: 'T1', status: 'occupied', seats: 4, guests: 4, timeElapsed: '1h 12m', server: 'Sarah', x: 30, y: 40, shape: 'rect', area: 'Main Dining' },
    { id: 'T2', name: 'T2', status: 'available', seats: 4, x: 180, y: 40, shape: 'round', area: 'Main Dining' },
    { id: 'T3', name: 'T3', status: 'dirty', seats: 2, x: 30, y: 200, shape: 'rect', area: 'Main Dining' },
    { id: 'T4', name: 'T4', status: 'occupied', seats: 4, guests: 2, timeElapsed: '12m', server: 'Mike', total: 74.50, x: 180, y: 200, shape: 'round', area: 'Main Dining' },
    { id: 'T5', name: 'T5', status: 'available', seats: 8, x: 340, y: 40, shape: 'rect', area: 'Main Dining' },
    { id: 'T6', name: 'T6', status: 'occupied', seats: 2, guests: 2, timeElapsed: '22m', server: 'Sarah', x: 340, y: 200, shape: 'rect', area: 'Main Dining' },
  ];

  const handleTableClick = (table: Table) => {
    if (selectedTable?.id === table.id) {
        setSelectedTable(null);
    } else {
        setSelectedTable(table);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'border-emerald-500 bg-emerald-500/10 text-emerald-500';
      case 'occupied': return 'border-rose-500 bg-rose-500/10 text-rose-500';
      case 'dirty': return 'border-amber-500 bg-amber-500/10 text-amber-500';
      default: return 'border-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-[#16202a]">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white dark:bg-background-dark border-b border-gray-200 dark:border-white/5 z-20 shadow-sm shrink-0">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold leading-tight dark:text-white">Floor Plan & Orders</h1>
          <span className="text-xs text-primary font-medium">Main Dining Room</span>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-primary font-semibold text-sm transition-colors">
            Edit Layout
        </button>
      </header>

      {/* Filter Chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white dark:bg-background-dark z-20 shadow-sm shrink-0 no-scrollbar">
        {['Main Dining', 'Patio', 'Bar', 'Private Room'].map((area, idx) => (
          <button
            key={area}
            className={`flex shrink-0 items-center justify-center px-4 h-9 rounded-full text-sm font-medium transition-colors ${
              idx === 0
                ? 'bg-primary text-background-dark shadow-lg shadow-primary/20'
                : 'bg-gray-100 dark:bg-surface-dark text-gray-600 dark:text-gray-300'
            }`}
          >
            {area}
          </button>
        ))}
      </div>

      {/* Map Area */}
      <div className="flex-1 relative overflow-auto cursor-move select-none" style={{ backgroundImage: 'radial-gradient(#324d67 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        {/* Tables Container - Simulating absolute layout */}
        <div className="absolute inset-0 min-w-[800px] min-h-[600px] p-8">
            {/* Render Tables */}
            {tables.map((table) => (
                <div
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    className={`absolute flex flex-col items-center justify-center border-2 rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 ${getStatusColor(table.status)} ${selectedTable?.id === table.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#16202a] scale-105 z-10' : ''}`}
                    style={{
                        top: table.y,
                        left: table.x,
                        width: table.id === 'T5' ? '160px' : '100px',
                        height: table.id === 'T5' ? '100px' : '130px',
                        borderRadius: table.shape === 'round' ? '999px' : '12px'
                    }}
                >
                    <div className="flex justify-between w-full px-2 absolute top-2">
                         {table.status === 'occupied' && <span className="text-[10px] font-bold">{table.timeElapsed}</span>}
                         <span className="material-symbols-outlined text-[14px]">
                            {table.status === 'available' ? 'check_circle' : table.status === 'dirty' ? 'cleaning_services' : 'group'}
                         </span>
                    </div>
                    <span className="text-white font-bold text-xl mt-2">{table.name}</span>
                    <span className="text-xs font-medium opacity-80 mt-1">
                        {table.status === 'available' ? `${table.seats} Seats` : `${table.guests}/${table.seats}`}
                    </span>
                     {table.status === 'dirty' && <span className="material-symbols-outlined text-amber-500 animate-pulse mt-1">cleaning_services</span>}
                </div>
            ))}
        </div>
      </div>

       {/* Floating Action Button */}
       <div className="absolute bottom-6 right-6 z-20 md:bottom-10 md:right-10">
        <button className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-background-dark shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      </div>

      {/* Bottom Sheet for Selected Table */}
      {selectedTable && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-surface-dark rounded-2xl p-4 shadow-2xl border border-gray-100 dark:border-white/5 z-30 animate-in slide-in-from-bottom-10 fade-in duration-300">
           <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4 md:hidden"></div>
           <div className="flex justify-between items-start mb-4">
             <div>
               <h3 className="text-xl font-bold text-slate-900 dark:text-white">Table {selectedTable.name} <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-1">• Main Dining</span></h3>
               <div className="flex items-center gap-2 mt-1">
                 <span className={`flex h-2 w-2 rounded-full ${selectedTable.status === 'occupied' ? 'bg-rose-500' : selectedTable.status === 'available' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                 <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{selectedTable.status}</span>
               </div>
             </div>
             {selectedTable.status === 'occupied' && (
                 <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{selectedTable.timeElapsed}</span>
                    <span className="text-xs text-gray-500">Elapsed</span>
                 </div>
             )}
           </div>

           <div className="grid grid-cols-4 gap-3 mb-4">
              <ActionButton icon="list_alt" label="Order" onClick={() => navigate('/pos')} />
              <ActionButton icon="payments" label="Pay" onClick={() => navigate('/checkout')} />
              <ActionButton icon="move_group" label="Move" />
              <ActionButton icon="cleaning_services" label="Dirty" active={selectedTable.status === 'dirty'} />
           </div>

           <button 
             onClick={() => navigate('/pos')}
             className="w-full h-12 rounded-xl bg-primary hover:bg-primary-dark text-background-dark font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary/20">
             <span>View Current Order</span>
             <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
           </button>
        </div>
      )}
    </div>
  );
};

const ActionButton: React.FC<{ icon: string; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
    <div className={`size-12 rounded-xl flex items-center justify-center transition-colors ${active ? 'bg-amber-500/20 text-amber-500' : 'bg-gray-100 dark:bg-[#233648] group-hover:bg-gray-200 dark:group-hover:bg-[#324d67] text-gray-700 dark:text-white'}`}>
      <span className="material-symbols-outlined text-[24px]">{icon}</span>
    </div>
    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
  </button>
);

export default Orders;