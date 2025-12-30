import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePrinter } from '../contexts/PrinterContext';
import { Order } from '../types';

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { activeOrders, tables, addOrder, updateTable, clearActiveOrder, inventory, updateInventoryItem, taxRate: globalTaxRate } = useData();
  const { isConnected, printOrder } = usePrinter();
  
  // Get data passed from POS
  const tableId = location.state?.tableId || 'T1';
  const orderType = location.state?.orderType || 'dine-in';
  const discount = location.state?.discount || 0;
  const orderNote = location.state?.orderNote || '';
  // Fallback to global tax rate if not provided in navigation state
  const taxRate = location.state?.taxRate !== undefined ? location.state.taxRate : globalTaxRate;
  
  const cart = activeOrders[tableId] || [];
  const table = tables.find(t => t.id === tableId);

  const [step, setStep] = useState<'summary' | 'method' | 'qr' | 'success'>('summary');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [printBill, setPrintBill] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discountAmount = subtotal * (discount / 100);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const tax = subtotalAfterDiscount * (taxRate / 100);
  const total = subtotalAfterDiscount + tax;

  const handleConfirmPayment = async () => {
      if (isProcessing) return;
      setIsProcessing(true);
      setError(null);

      try {
        // Create Order in History
        const newOrder: Order = {
            id: `ORD-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`,
            customerName: 'Guest',
            table: table?.name || 'Unknown',
            date: new Date().toISOString(),
            total: total,
            status: 'completed',
            items: cart.map(i => ({ 
                name: i.name, 
                quantity: i.quantity,
                price: i.price,
                notes: i.notes 
            })),
            paymentMethod: paymentMethod,
            orderType: orderType,
            discount: discount,
            notes: orderNote
        };

        await addOrder(newOrder);
        setLastOrder(newOrder);

        // Deduct Inventory in Supabase
        for (const cartItem of cart) {
            // 1. Try Link by ID
            let invItem = inventory.find(i => i.id === cartItem.inventoryId);
            
            // 2. Fallback Link by Name
            if (!invItem) {
                invItem = inventory.find(i => i.name.toLowerCase() === cartItem.name.toLowerCase());
            }
            
            if (invItem) {
                const newStock = Math.max(0, invItem.stock - cartItem.quantity);
                await updateInventoryItem({
                    ...invItem,
                    stock: newStock,
                    status: newStock <= invItem.minStock ? 'low-stock' : 'in-stock'
                });
            }
            // Removed redundant fallback update to menuItems.stock
        }

        // Clear Table Status if it was dine-in
        if (table && orderType === 'dine-in') {
            await updateTable({
                ...table,
                status: 'dirty',
                guests: 0,
                total: 0,
                timeElapsed: undefined
            });
        }
        
        // Always clear cart after payment
        await clearActiveOrder(tableId);

        setStep('success');
        
        // Auto print if selected
        if (printBill) {
            let printed = false;
            if (isConnected) {
                printed = await printOrder(newOrder);
            }
            
            // Fallback if USB print failed or not connected
            if (!printed) {
                setTimeout(() => {
                    window.print();
                }, 500);
            }
        }

      } catch (err: any) {
          console.error("Payment processing error:", err);
          setError("Transaction failed. Please try again. " + (err.message || ''));
      } finally {
          setIsProcessing(false);
      }
  };

  if (step === 'success') {
      return (
          <div className="flex flex-col items-center justify-center h-full bg-background-light dark:bg-background-dark p-6 text-center animate-in fade-in zoom-in duration-300 print:hidden">
              <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mb-6">
                  <span className="material-symbols-outlined text-5xl">check_circle</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{t('checkout.success')}</h2>
              <p className="text-slate-500 dark:text-gray-400 mb-8">{t('checkout.completed')}</p>
              <div className="flex gap-4">
                  <button onClick={() => navigate('/tables')} className="px-6 py-3 bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 rounded-xl font-bold text-slate-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
                      {t('checkout.back_tables')}
                  </button>
                  <button onClick={() => navigate('/pos')} className="px-6 py-3 bg-primary text-background-dark rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                      {t('checkout.new_order')}
                  </button>
              </div>
              {/* Receipt logic handles the print view separately below */}
              {lastOrder && (
                  <div className="hidden print:block fixed inset-0 bg-white z-[100] p-8 text-black text-left font-mono">
                      <div className="text-center mb-6">
                          <h1 className="text-3xl font-bold mb-1">EcoPOS</h1>
                          <p className="text-sm">Restaurant System</p>
                      </div>
                      
                      <div className="border-b-2 border-black pb-2 mb-4">
                          <p>Order ID: {lastOrder.id}</p>
                          <p>Date: {new Date(lastOrder.date).toLocaleString()}</p>
                          <p>Table: {lastOrder.table}</p>
                      </div>

                      <div className="flex flex-col gap-2 border-b-2 border-black pb-4 mb-4">
                          {lastOrder.items.map((item, idx) => {
                              // Find original price if possible, or we might need to persist price in order items
                              // For now, assuming price hasn't changed drastically or not showing unit price on simple receipt
                              return (
                                  <div key={idx} className="flex justify-between">
                                      <span>{item.quantity}x {item.name}</span>
                                  </div>
                              );
                          })}
                      </div>

                      <div className="flex flex-col gap-1 text-right font-bold mb-6">
                          {lastOrder.discount ? <p>Discount: {lastOrder.discount}%</p> : null}
                          <p className="text-xl">Total: {lastOrder.total.toLocaleString()} ₫</p>
                          <p className="text-xs font-normal">({lastOrder.paymentMethod})</p>
                      </div>

                      <div className="text-center text-sm">
                          <p>{t('checkout.bill_thankyou')}</p>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  return (
    <>
    {/* Screen View */}
    <div className="flex flex-col h-full w-full bg-background-light dark:bg-background-dark relative overflow-hidden print:hidden">
        <header className="flex items-center px-6 py-4 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-white/5 z-10">
            <button onClick={() => navigate(-1)} className="mr-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('checkout.title')}</h1>
            <span className="ml-auto px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm font-bold uppercase">{orderType}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6 max-w-6xl mx-auto w-full">
            {/* Order Summary */}
            <div className="flex-1 bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('checkout.summary')}</h2>
                    <span className="text-sm font-bold text-slate-500">{t('checkout.table')} {table?.name || 'N/A'}</span>
                </div>
                
                {orderNote && (
                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl">
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">{t('checkout.note')}</p>
                        <p className="text-sm text-slate-700 dark:text-white italic">"{orderNote}"</p>
                    </div>
                )}

                <div className="flex flex-col gap-4 mb-6 max-h-[300px] overflow-y-auto">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start">
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded bg-gray-200 dark:bg-white/10 flex items-center justify-center font-bold text-xs text-slate-500 dark:text-gray-400">
                                    {item.quantity}x
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                                    {item.notes && <p className="text-xs text-gray-400 italic">{item.notes}</p>}
                                </div>
                            </div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{(item.price * item.quantity).toLocaleString()} ₫</p>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <p className="text-center text-gray-400 italic">No items in order.</p>
                    )}
                </div>
                
                <div className="border-t border-gray-100 dark:border-white/5 pt-4 flex flex-col gap-2">
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>{t('pos.subtotal')}</span>
                        <span>{subtotal.toLocaleString()} ₫</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-sm text-primary">
                            <span>{t('pos.discount')} ({discount}%)</span>
                            <span>- {discountAmount.toLocaleString()} ₫</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>{t('pos.tax')} ({taxRate}%)</span>
                        <span>{tax.toLocaleString()} ₫</span>
                    </div>
                    <div className="flex justify-between text-xl font-black text-slate-900 dark:text-white mt-2">
                        <span>{t('pos.total')}</span>
                        <span className="text-primary">{total.toLocaleString()} ₫</span>
                    </div>
                </div>
            </div>

            {/* Payment Method */}
            <div className="w-full md:w-96 flex flex-col gap-4">
                {error && (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm flex items-center gap-2">
                         <span className="material-symbols-outlined">error</span>
                         {error}
                    </div>
                )}

                <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-white/5">
                     <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('checkout.payment_method')}</h2>
                     <div className="grid grid-cols-2 gap-3">
                        {['Cash', 'Card', 'QR Code', 'Wallet'].map((method) => {
                            let label = method;
                            if (method === 'Cash') label = t('checkout.cash');
                            if (method === 'Card') label = t('checkout.card');
                            if (method === 'QR Code') label = t('checkout.qr');
                            if (method === 'Wallet') label = t('checkout.wallet');

                            return (
                            <button
                                key={method}
                                onClick={() => setPaymentMethod(method.toLowerCase())}
                                disabled={isProcessing}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                                    paymentMethod === method.toLowerCase()
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-transparent bg-gray-5 dark:bg-white/5 text-slate-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                                }`}
                            >
                                <span className="material-symbols-outlined text-2xl mb-2">
                                    {method === 'Cash' ? 'payments' : method === 'Card' ? 'credit_card' : method === 'QR Code' ? 'qr_code_scanner' : 'account_balance_wallet'}
                                </span>
                                <span className="font-bold text-sm">{label}</span>
                            </button>
                        )})}
                     </div>
                </div>

                {/* Print Bill Toggle */}
                <div 
                    onClick={() => !isProcessing && setPrintBill(!printBill)}
                    className={`flex items-center gap-3 bg-white dark:bg-surface-dark p-4 rounded-2xl border transition-all cursor-pointer select-none ${printBill ? 'border-primary/50 shadow-sm' : 'border-gray-100 dark:border-white/5'}`}
                >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${printBill ? 'bg-primary border-primary text-background-dark' : 'border-slate-300 dark:border-slate-600 bg-transparent'}`}>
                        {printBill && <span className="material-symbols-outlined text-sm font-bold">check</span>}
                    </div>
                    <span className="font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">receipt</span>
                        {t('checkout.print_bill')}
                        {isConnected && printBill && (
                            <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded font-bold">USB</span>
                        )}
                    </span>
                </div>

                <button 
                    onClick={handleConfirmPayment}
                    disabled={cart.length === 0 || isProcessing}
                    className="w-full bg-primary hover:bg-primary-dark text-background-dark font-bold text-xl py-4 rounded-xl shadow-lg shadow-primary/20 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? (
                        <>
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            <span>{t('checkout.processing')}</span>
                        </>
                    ) : (
                        <>
                            <span>{t('checkout.confirm')}</span>
                            <span className="material-symbols-outlined">check</span>
                        </>
                    )}
                </button>
            </div>
        </main>
    </div>

    {/* Hidden Print Receipt Template */}
    {/* This is only visible when printing via Browser dialog (fallback) */}
    <div className="hidden print:block fixed inset-0 bg-white z-[100] p-6 text-black text-left font-mono text-sm leading-relaxed">
        <div className="text-center mb-6 border-b border-black pb-4">
            <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">{t('checkout.bill_header')}</h1>
            <p className="text-xs">123 Restaurant Street, City</p>
            <p className="text-xs">Tel: (012) 345-6789</p>
        </div>
        
        {/* If lastOrder is available (post success), show it. Otherwise show current cart preview */}
        {lastOrder ? (
            <>
                <div className="mb-4 text-xs">
                    <div className="flex justify-between"><span>ID:</span> <span className="font-bold">#{lastOrder.id}</span></div>
                    <div className="flex justify-between"><span>Date:</span> <span>{new Date(lastOrder.date).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Table:</span> <span className="font-bold">{lastOrder.table}</span></div>
                    <div className="flex justify-between"><span>Type:</span> <span className="uppercase">{lastOrder.orderType}</span></div>
                </div>

                <div className="border-t border-b border-black py-2 mb-4 dashed">
                    <div className="flex justify-between font-bold mb-2 text-xs uppercase">
                        <span>Item</span>
                        <span>Qty</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        {lastOrder.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                                <span>{item.name}</span>
                                <span>x{item.quantity}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-1 text-right mb-6">
                    {lastOrder.discount ? <div className="flex justify-between"><span>Discount:</span><span>{lastOrder.discount}%</span></div> : null}
                    <div className="flex justify-between text-lg font-bold border-t border-black pt-2 mt-1">
                        <span>Total:</span>
                        <span>{lastOrder.total.toLocaleString()} ₫</span>
                    </div>
                    <p className="text-xs italic mt-1">({lastOrder.paymentMethod})</p>
                </div>
            </>
        ) : (
            /* Preview Print before confirmation (if triggered manually) */
            <>
                <div className="mb-4 text-xs">
                    <div className="flex justify-between"><span>Date:</span> <span>{new Date().toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Table:</span> <span className="font-bold">{table?.name}</span></div>
                </div>
                <div className="border-t border-b border-black py-2 mb-4">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                            <span>{item.name}</span>
                            <span>{item.quantity} x {item.price.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
                <div className="text-right font-bold text-lg">
                    Total: {total.toLocaleString()} ₫
                </div>
            </>
        )}

        <div className="text-center text-xs mt-8 border-t border-black pt-4">
            <p>{t('checkout.bill_thankyou')}</p>
            <p>Wifi: EcoPOS_Guest / Pass: 12345678</p>
        </div>
    </div>
    </>
  );
};

export default Checkout;