import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table } from '../types';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageContext';

const Tables: React.FC = () => {
  const navigate = useNavigate();
  const { tables, updateTable, updateTables, deleteTable, clearActiveOrder } = useData();
  const { t } = useLanguage();
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeArea, setActiveArea] = useState('All');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  
  // Local state for tables to allow smooth dragging without DB spam
  const [localTables, setLocalTables] = useState<Table[]>(tables);

  // Real-time Update Visuals
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());
  const previousTables = useRef<Table[]>(tables);

  // Sync local tables with context tables when not dragging
  useEffect(() => {
     if (!draggingId) {
         setLocalTables(tables);
     }
  }, [tables]);

  // Timer Effect to update elapsed time strings locally
  useEffect(() => {
    const interval = setInterval(() => {
        setLocalTables(prevTables => prevTables.map(t => {
            if (t.status === 'occupied' && t.occupiedSince) {
                const now = new Date();
                const start = new Date(t.occupiedSince);
                const diffMs = now.getTime() - start.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const hours = Math.floor(diffMins / 60);
                const mins = diffMins % 60;
                const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                
                if (t.timeElapsed !== timeStr) {
                    return { ...t, timeElapsed: timeStr };
                }
            }
            return t;
        }));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Effect to detect real-time changes and trigger visual cues
  useEffect(() => {
      const changes = new Set<string>();
      
      tables.forEach(t => {
          const prev = previousTables.current.find(p => p.id === t.id);
          // Check if table is new or modified compared to previous render
          if (!prev || JSON.stringify(prev) !== JSON.stringify(t)) {
              changes.add(t.id);
          }
      });

      if (changes.size > 0) {
          setUpdatedIds(prev => {
              const next = new Set(prev);
              changes.forEach(id => next.add(id));
              return next;
          });

          const timer = setTimeout(() => {
              setUpdatedIds(prev => {
                  const next = new Set(prev);
                  changes.forEach(id => next.delete(id));
                  return next;
              });
          }, 2000);

          return () => clearTimeout(timer);
      }
      
      previousTables.current = tables;
  }, [tables]);

  const areas = [
      { id: 'Main Dining', label: t('tables.area_main') }, 
      { id: 'Patio', label: t('tables.area_patio') }, 
      { id: 'Bar', label: t('tables.area_bar') }, 
      { id: 'Private', label: t('tables.area_private') }
  ];

  // Dragging Logic
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent, table: Table) => {
    if (!isEditMode) {
        setSelectedTableId(table.id);
        return;
    }
    // Prevent default touch actions like scrolling
    e.preventDefault();
    e.stopPropagation();
    
    // Capture pointer to ensure we get move/up events even outside container
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setDraggingId(table.id);
    setSelectedTableId(table.id); // Also select it for editing
    setDragOffset({
        x: e.clientX - table.x,
        y: e.clientY - table.y
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !isEditMode) return;
    
    e.preventDefault();

    // Map Boundaries
    let bounds = { width: 2000, height: 2000 }; // Default large fallback
    if (mapRef.current) {
        const rect = mapRef.current.getBoundingClientRect();
        bounds = { width: rect.width, height: rect.height };
    }
    
    // Update LOCAL state for smooth UI
    setLocalTables(prev => prev.map(t => {
        if (t.id === draggingId) {
            // Raw calculation
            let rawX = e.clientX - dragOffset.x;
            let rawY = e.clientY - dragOffset.y;

            // Snap to grid (10px)
            let newX = Math.round(rawX / 10) * 10;
            let newY = Math.round(rawY / 10) * 10;

            // Boundary Constraint
            const tableWidth = t.shape === 'round' ? 100 : 140;
            const tableHeight = 100;
            
            // Constrain within map padding (e.g., 0 to width - tableWidth)
            newX = Math.max(0, Math.min(newX, bounds.width - tableWidth));
            newY = Math.max(0, Math.min(newY, bounds.height - tableHeight));

            return {
                ...t,
                x: newX,
                y: newY
            };
        }
        return t;
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
        const draggedTable = localTables.find(t => t.id === draggingId);
        if (draggedTable) {
            // Commit to DB/Context only on drop
            updateTable(draggedTable);
        }
        setDraggingId(null);
        
        // Release pointer capture
        if (e.target instanceof HTMLElement) {
            try {
                e.target.releasePointerCapture(e.pointerId);
            } catch (err) {
                // Ignore if not captured
            }
        }
    }
  };

  const addNewTable = () => {
      const newId = `T${Date.now().toString().slice(-4)}`;
      const newTable: Table = {
          id: newId,
          name: `${localTables.length + 1}`,
          status: 'available',
          seats: 4,
          x: 100,
          y: 100,
          shape: 'rect',
          area: activeArea === 'All' ? 'Main Dining' : activeArea
      };
      updateTables([...tables, newTable]);
      setSelectedTableId(newId);
  };

  const handleDeleteTable = (id: string) => {
      deleteTable(id);
      setSelectedTableId(null);
  };

  const updateTableStatusLocal = (id: string, status: Table['status']) => {
      const table = tables.find(t => t.id === id);
      if (!table) return;
      
      let updated: Table = { 
          ...table, 
          status, 
      };

      if (status === 'occupied') {
          updated.occupiedSince = new Date().toISOString();
          updated.guests = updated.guests || table.seats;
          updated.timeElapsed = '0m';
      } else if (status === 'available') {
          updated.occupiedSince = undefined;
          updated.timeElapsed = undefined;
          updated.guests = undefined;
          updated.total = 0;
          clearActiveOrder(id);
      }
      
      updateTable(updated);
  };

  const updateTableShape = (id: string, shape: 'round' | 'rect') => {
      const table = tables.find(t => t.id === id);
      if (table) updateTable({ ...table, shape });
  };

  const updateTableArea = (id: string, area: string) => {
      const table = tables.find(t => t.id === id);
      if (table) updateTable({ ...table, area });
  };

  const updateTableSeats = (id: string, seats: number) => {
      const table = tables.find(t => t.id === id);
      if (table) updateTable({ ...table, seats: Math.max(1, seats) });
  };

  const updateTableGuests = (id: string, guests: number) => {
      const table = tables.find(t => t.id === id);
      if (table) updateTable({ ...table, guests: Math.max(1, guests) });
  };

  // Filter Tables
  const filteredTables = activeArea === 'All' ? localTables : localTables.filter(t => t.area === activeArea);
  const selectedTable = localTables.find(t => t.id === selectedTableId);

  // Helper for Status Styles
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'available': return {
          bg: 'bg-white dark:bg-[#1e293b]',
          border: 'border-emerald-500',
          text: 'text-emerald-600 dark:text-emerald-400',
          indicator: 'bg-emerald-500',
          shadow: 'shadow-emerald-500/10'
      };
      case 'occupied': return {
          bg: 'bg-rose-50 dark:bg-rose-900/20',
          border: 'border-rose-500',
          text: 'text-rose-600 dark:text-rose-400',
          indicator: 'bg-rose-500',
          shadow: 'shadow-rose-500/10'
      };
      case 'dirty': return {
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          border: 'border-amber-500',
          text: 'text-amber-600 dark:text-amber-400',
          indicator: 'bg-amber-500',
          shadow: 'shadow-amber-500/10'
      };
      default: return {
          bg: 'bg-gray-100',
          border: 'border-gray-400',
          text: 'text-gray-500',
          indicator: 'bg-gray-400',
          shadow: ''
      };
    }
  };

  return (
    <div 
        className="flex flex-col h-full w-full relative bg-[#f0f4f8] dark:bg-[#0f172a] overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-white/5 z-20 shadow-sm shrink-0">
        <div>
          <h1 className="text-xl font-bold leading-tight text-slate-900 dark:text-white">{t('tables.title')}</h1>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-gray-400">
             <span className={`w-2 h-2 rounded-full ${isEditMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
             {isEditMode ? t('tables.editing') : t('tables.live_view')}
          </div>
        </div>
        <div className="flex gap-3">
             {isEditMode && (
                 <button 
                    onClick={addNewTable}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-95"
                 >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    {t('tables.add_table')}
                 </button>
             )}
            <button 
                onClick={() => {
                    setIsEditMode(!isEditMode);
                    setSelectedTableId(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${
                    isEditMode 
                    ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20' 
                    : 'bg-white dark:bg-surface-dark text-slate-700 dark:text-white border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
            >
                <span className="material-symbols-outlined text-[18px]">{isEditMode ? 'check' : 'edit_square'}</span>
                {isEditMode ? t('tables.done') : t('tables.edit_layout')}
            </button>
        </div>
      </header>

      {/* Filter Chips */}
      <div className="flex gap-2 px-6 py-3 overflow-x-auto bg-white/50 dark:bg-surface-dark/50 backdrop-blur-md z-10 shrink-0 no-scrollbar border-b border-gray-200 dark:border-white/5">
        <button
            onClick={() => setActiveArea('All')}
            className={`flex shrink-0 items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
              activeArea === 'All'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md transform scale-105'
                : 'bg-white dark:bg-surface-dark text-slate-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-slate-300'
            }`}
          >
            {t('tables.all_areas')}
          </button>
        {areas.map((area) => (
          <button
            key={area.id}
            onClick={() => setActiveArea(area.id)}
            className={`flex shrink-0 items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
              activeArea === area.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md transform scale-105'
                : 'bg-white dark:bg-surface-dark text-slate-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-slate-300'
            }`}
          >
            {area.label}
          </button>
        ))}
      </div>

      {/* Map Area */}
      <div 
        ref={mapRef}
        className={`flex-1 relative overflow-hidden select-none touch-none ${isEditMode ? 'cursor-grab' : ''}`}
        style={{ 
            backgroundImage: `radial-gradient(${isEditMode ? '#94a3b8' : '#cbd5e1'} 1px, transparent 1px)`, 
            backgroundSize: '24px 24px',
            backgroundColor: isEditMode ? 'rgba(0,0,0,0.02)' : 'transparent'
        }}
      >
        <div className="absolute inset-0 transition-transform duration-200">
            {filteredTables.map((table) => {
                const styles = getStatusStyles(table.status);
                const isSelected = selectedTableId === table.id;
                const isUpdated = updatedIds.has(table.id);
                const isDragging = draggingId === table.id;
                
                return (
                <div
                    key={table.id}
                    onPointerDown={(e) => handlePointerDown(e, table)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className={`absolute flex flex-col items-center justify-center transition-all duration-75 ${styles.shadow} ${
                        isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${isUpdated ? 'ring-4 ring-primary ring-offset-2 ring-offset-[#f0f4f8] dark:ring-offset-[#0f172a] scale-105 z-50' : ''} ${isDragging ? 'z-[100] scale-110 shadow-2xl opacity-90' : ''}`}
                    style={{
                        top: table.y,
                        left: table.x,
                        width: table.shape === 'round' ? '100px' : '140px',
                        height: table.shape === 'round' ? '100px' : '100px',
                        borderRadius: table.shape === 'round' ? '50%' : '16px',
                        transform: isSelected && !isDragging ? 'scale(1.05)' : 'scale(1)',
                        zIndex: isDragging ? 100 : (isSelected ? 50 : 10),
                        touchAction: 'none' // Critical for pointer events
                    }}
                >
                    {/* Table Body */}
                    <div className={`w-full h-full border-2 ${styles.bg} ${styles.border} ${table.shape === 'round' ? 'rounded-full' : 'rounded-2xl'} flex flex-col items-center justify-center relative overflow-hidden pointer-events-none`}>
                         
                         {/* Selection Ring */}
                         {isSelected && <div className="absolute inset-0 border-4 border-primary/50 rounded-inherit animate-pulse"></div>}
                         {isEditMode && <div className="absolute inset-0 border-2 border-dashed border-slate-400/50 rounded-inherit"></div>}

                         <span className={`text-lg font-black ${styles.text}`}>{table.name}</span>
                         
                         {/* Edit Mode Area Label */}
                         {isEditMode && (
                             <span className="text-[9px] font-bold text-slate-400 bg-white/80 dark:bg-black/40 px-1.5 py-0.5 rounded mt-1 max-w-[90%] truncate">
                                 {table.area}
                             </span>
                         )}

                         {!isEditMode && table.status === 'occupied' && (
                             <div className="flex flex-col items-center mt-1">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-black/20 px-1.5 rounded">{table.timeElapsed || '0m'}</span>
                             </div>
                         )}

                         {!isEditMode && table.status === 'available' && (
                             <span className="text-[10px] font-bold text-emerald-500/80 mt-1 uppercase tracking-wide">{t('tables.status_open')}</span>
                         )}

                        {!isEditMode && table.status === 'dirty' && (
                             <span className="material-symbols-outlined text-amber-500 mt-1 animate-pulse">cleaning_services</span>
                         )}
                    </div>

                    {/* Status Indicator Dot */}
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${styles.indicator} shadow-sm z-10 pointer-events-none`}></div>

                    {/* Visual Chairs (Purely decorative based on seat count) */}
                    <div className="absolute inset-0 pointer-events-none">
                         {[...Array(table.seats)].map((_, i) => {
                             const angle = (i * (360 / table.seats)) * (Math.PI / 180);
                             const radius = table.shape === 'round' ? 58 : 65; // Distance from center
                             // Simple positioning logic for visual flair
                             const chairX = 50 + radius * Math.cos(angle); 
                             const chairY = 50 + radius * Math.sin(angle);
                             
                             return (
                                 <div 
                                    key={i}
                                    className="absolute w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full border border-gray-300 dark:border-slate-600 shadow-sm"
                                    style={{
                                        left: `calc(${chairX}% - 16px)`,
                                        top: `calc(${chairY}% - 16px)`,
                                        zIndex: -1
                                    }}
                                 ></div>
                             )
                         })}
                    </div>
                </div>
            )})}
        </div>
      </div>

       {/* Floating Action Button (Quick Add Order) */}
       {!isEditMode && (
           <div className="absolute bottom-6 right-6 z-20 md:bottom-10 md:right-10">
            <button 
                onClick={() => navigate('/pos')}
                className="group flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-900 dark:bg-primary text-white dark:text-background-dark shadow-2xl shadow-slate-900/30 dark:shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[32px] group-hover:rotate-90 transition-transform duration-300">add</span>
            </button>
          </div>
       )}

      {/* Selected Table Bottom Sheet */}
      {selectedTable && !isEditMode && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[400px] bg-white/90 dark:bg-surface-dark/95 backdrop-blur-xl rounded-3xl p-5 shadow-2xl border border-white/20 dark:border-white/5 z-30 animate-in slide-in-from-bottom-10 fade-in duration-300 ring-1 ring-black/5">
           
           <div className="flex justify-between items-start mb-6">
             <div className="flex gap-4">
                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner ${
                     selectedTable.status === 'occupied' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' :
                     selectedTable.status === 'dirty' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                     'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                 }`}>
                     {selectedTable.name}
                 </div>
                 <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {t('checkout.table')} {selectedTable.name}
                        <span className="text-xs font-normal px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300">{selectedTable.area}</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-medium text-slate-500 dark:text-gray-400 capitalize">
                            {selectedTable.status === 'available' ? t('tables.status_open') : selectedTable.status === 'occupied' ? t('tables.status_occupied') : t('tables.status_dirty')}
                        </span>
                        <span className="text-slate-300 dark:text-gray-600">•</span>
                        <span className="text-sm font-medium text-slate-500 dark:text-gray-400">{selectedTable.seats} {t('tables.seats')}</span>
                    </div>
                 </div>
             </div>
             <button onClick={() => setSelectedTableId(null)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors">
                 <span className="material-symbols-outlined">close</span>
             </button>
           </div>

           {selectedTable.status === 'occupied' && (
               <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-4 mb-6 border border-gray-100 dark:border-white/5">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-white/5">
                        <div className="flex flex-col">
                             <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">{t('tables.guests')}</p>
                             <div className="flex items-center gap-3">
                                <button onClick={() => updateTableGuests(selectedTable.id, (selectedTable.guests || 1) - 1)} className="size-8 rounded-lg bg-white dark:bg-white/5 shadow-sm flex items-center justify-center hover:text-primary"><span className="material-symbols-outlined text-sm">remove</span></button>
                                <input 
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={selectedTable.guests || 1}
                                    onChange={(e) => updateTableGuests(selectedTable.id, parseInt(e.target.value) || 1)}
                                    className="w-12 text-center bg-transparent border-none text-xl font-bold text-slate-900 dark:text-white focus:ring-0 p-0 appearance-none"
                                />
                                <button onClick={() => updateTableGuests(selectedTable.id, (selectedTable.guests || 1) + 1)} className="size-8 rounded-lg bg-white dark:bg-white/5 shadow-sm flex items-center justify-center hover:text-primary"><span className="material-symbols-outlined text-sm">add</span></button>
                             </div>
                        </div>
                        <div className="text-right">
                             <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">{t('tables.time')}</p>
                             <div className="flex items-center gap-1 justify-end text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-sm">schedule</span>
                                <span className="text-lg font-mono font-bold">{selectedTable.timeElapsed}</span>
                             </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-end">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">{t('tables.current_order')}</p>
                        <p className="text-2xl font-black text-primary">{(selectedTable.total || 0).toLocaleString()} ₫</p>
                    </div>
               </div>
           )}

           <div className="grid grid-cols-4 gap-3 mb-6">
              <ActionButton 
                icon="list_alt" 
                label={t('tables.action_order')} 
                color="bg-blue-500" 
                onClick={() => navigate('/pos', { state: { tableId: selectedTable.id } })} 
              />
              <ActionButton 
                icon="payments" 
                label={t('tables.action_pay')} 
                color="bg-emerald-500" 
                onClick={() => navigate('/checkout', { state: { tableId: selectedTable.id } })} 
                disabled={selectedTable.status === 'available'}
              />
              <ActionButton 
                icon="cleaning_services" 
                label={t('tables.action_clean')} 
                color="bg-amber-500"
                active={selectedTable.status === 'dirty'} 
                onClick={() => updateTableStatusLocal(selectedTable.id, 'available')}
              />
              <ActionButton 
                icon="block" 
                label={t('tables.action_occupy')} 
                color="bg-rose-500"
                active={selectedTable.status === 'occupied'}
                onClick={() => updateTableStatusLocal(selectedTable.id, 'occupied')} 
              />
           </div>

           <button 
             onClick={() => navigate('/pos', { state: { tableId: selectedTable.id } })}
             className="w-full h-14 rounded-xl bg-slate-900 dark:bg-primary hover:opacity-90 active:scale-[0.98] text-white dark:text-background-dark font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg"
            >
             <span>{selectedTable.status === 'occupied' ? t('tables.btn_update_order') : t('tables.btn_new_order')}</span>
             <span className="material-symbols-outlined">arrow_forward</span>
           </button>
        </div>
      )}

      {/* Edit Mode Toolbar */}
      {selectedTable && isEditMode && (
         <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-surface-dark rounded-2xl p-2 shadow-2xl border border-gray-200 dark:border-white/10 z-30 flex gap-2 animate-in slide-in-from-bottom-4 fade-in items-center">
             <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                 <button 
                    onClick={() => updateTableShape(selectedTable.id, 'round')} 
                    className={`p-2 rounded-lg transition-all ${selectedTable.shape === 'round' ? 'bg-white dark:bg-white/10 shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                     <span className="material-symbols-outlined text-[20px]">circle</span>
                 </button>
                 <button 
                    onClick={() => updateTableShape(selectedTable.id, 'rect')} 
                    className={`p-2 rounded-lg transition-all ${selectedTable.shape === 'rect' ? 'bg-white dark:bg-white/10 shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                     <span className="material-symbols-outlined text-[20px]">crop_square</span>
                 </button>
             </div>
             
             <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-1"></div>
             
             {/* Area Selector */}
             <div className="relative">
                 <select 
                    value={selectedTable.area} 
                    onChange={(e) => updateTableArea(selectedTable.id, e.target.value)}
                    className="appearance-none bg-gray-100 dark:bg-white/5 border-none rounded-xl py-2.5 pl-3 pr-8 text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-primary cursor-pointer"
                 >
                     {areas.map(area => (
                         <option key={area.id} value={area.id}>{area.label}</option>
                     ))}
                 </select>
                 <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <span className="material-symbols-outlined text-[18px]">expand_more</span>
                 </div>
             </div>

             <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-1"></div>
             
             {/* Seat Capacity Control */}
             <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                <button 
                    onClick={() => updateTableSeats(selectedTable.id, selectedTable.seats - 1)}
                    className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-white/10 shadow-sm text-gray-600 dark:text-gray-300 hover:text-primary active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <div className="w-8 text-center">
                    <span className="text-xs text-gray-400 font-bold block leading-none">{t('tables.seats').toUpperCase()}</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-white leading-none">{selectedTable.seats}</span>
                </div>
                <button 
                    onClick={() => updateTableSeats(selectedTable.id, selectedTable.seats + 1)}
                    className="size-8 flex items-center justify-center rounded-lg bg-white dark:bg-white/10 shadow-sm text-gray-600 dark:text-gray-300 hover:text-primary active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
             </div>

             <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-1"></div>

             <button onClick={() => handleDeleteTable(selectedTable.id)} className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20">
                 <span className="material-symbols-outlined">delete</span>
             </button>
         </div>
      )}
    </div>
  );
};

interface ActionButtonProps {
    icon: string;
    label: string;
    active?: boolean;
    color?: string;
    disabled?: boolean;
    onClick?: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, active, color = 'bg-primary', disabled, onClick }) => (
    <button 
        onClick={onClick} 
        disabled={disabled}
        className={`flex flex-col items-center gap-2 group ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
    <div className={`size-14 rounded-2xl flex items-center justify-center transition-all shadow-sm group-active:scale-95 ${
        active 
        ? `${color} text-white shadow-lg` 
        : 'bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
    }`}>
      <span className="material-symbols-outlined text-[24px]">{icon}</span>
    </div>
    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{label}</span>
  </button>
);

export default Tables;