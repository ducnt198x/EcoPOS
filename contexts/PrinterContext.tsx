import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { generateOrderReceipt, generateTestReceipt } from '../services/escpos';
import { Order } from '../types';

interface PrinterContextType {
  device: any | null;
  isConnected: boolean;
  connectPrinter: () => Promise<void>;
  disconnectPrinter: () => Promise<void>;
  printOrder: (order: Order) => Promise<boolean>;
  printTest: () => Promise<boolean>;
  error: string | null;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export const PrinterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [device, setDevice] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-reconnect if previously permitted
  useEffect(() => {
      const nav = navigator as any;
      if (nav.usb) {
          nav.usb.getDevices()
            .then(async (devices: any[]) => {
                if (devices.length > 0) {
                    const firstDevice = devices[0];
                    // Silent auto-connect attempt
                    await openDevice(firstDevice, true); 
                }
            })
            .catch((err: any) => {
                console.warn("WebUSB getDevices warning:", err);
            });
          
          // Listen for disconnects
          const handleDisconnect = (event: any) => {
              if (device && event.device === device) {
                  setDevice(null);
                  setError("Printer disconnected.");
              }
          };
          
          nav.usb.addEventListener('disconnect', handleDisconnect);
          return () => nav.usb.removeEventListener('disconnect', handleDisconnect);
      }
  }, [device]);

  const connectPrinter = async () => {
    setError(null);
    const nav = navigator as any;
    if (!nav.usb) {
        setError("WebUSB is not supported in this browser.");
        return;
    }

    try {
        // Requesting device prompts the permission dialog
        const selectedDevice = await nav.usb.requestDevice({ filters: [] });
        await openDevice(selectedDevice, false);
    } catch (err: any) {
        console.error("Printer Connection Error:", err);
        // Don't show error if user cancelled
        if (!err.message.includes('No device selected')) {
            setError("Connection failed: " + err.message);
        }
    }
  };

  const openDevice = async (selectedDevice: any, silent: boolean = false) => {
      try {
        // Step 1: Open the device
        // We wrap this in a specific try/catch because 'Access denied' usually happens here
        if (!selectedDevice.opened) {
            try {
                await selectedDevice.open();
            } catch (e: any) {
                // Retry strategy: Try to close (reset) then open again
                // This helps with stale handles on Windows
                try { await selectedDevice.close(); } catch (ignore) {}
                
                try {
                    await selectedDevice.open();
                } catch (retryErr: any) {
                     if (retryErr.name === 'SecurityError' || retryErr.message?.includes('Access denied')) {
                         throw new Error("Access Denied: Windows is blocking access. Please use 'Zadig' to install the WinUSB driver for this printer.");
                     }
                     throw retryErr;
                }
            }
        }
        
        // Step 2: Select Configuration
        if (selectedDevice.configuration === null) {
            await selectedDevice.selectConfiguration(1);
        }
        
        // Step 3: Claim Interface
        try {
            await selectedDevice.claimInterface(0);
        } catch (claimErr: any) {
            console.warn("Interface claim warning (ignoring):", claimErr);
        }
        
        setDevice(selectedDevice);
        if (!silent) setError(null); // Clear previous errors on success
      } catch (err: any) {
          console.error("Error opening device:", err);
          setDevice(null);
          
          if (!silent) {
              setError(err.message || "Device open error");
          }
      }
  };

  const disconnectPrinter = async () => {
      if (device) {
          try {
              await device.close();
          } catch (e) { console.error(e); }
          setDevice(null);
      }
  };

  const sendToPrinter = async (data: Uint8Array): Promise<boolean> => {
      if (!device) return false;

      try {
          // 1. Ensure device is open
          if (!device.opened) {
              await device.open();
              if (device.configuration === null) await device.selectConfiguration(1);
              try { await device.claimInterface(0); } catch(e) {}
          }

          // 2. Find Endpoint
          let endpointNumber = 1; 
          if (device.configuration && device.configuration.interfaces) {
              const iface = device.configuration.interfaces[0];
              if (iface && iface.alternates && iface.alternates[0]) {
                  const endpoint = iface.alternates[0].endpoints.find((e: any) => e.direction === 'out');
                  if (endpoint) {
                      endpointNumber = endpoint.endpointNumber;
                  }
              }
          }

          // 3. Transfer
          await device.transferOut(endpointNumber, data);
          return true;

      } catch (err: any) {
          console.error("Print Transfer Error:", err);
          
          // 4. Retry Logic: Handle stale handles by resetting
          if (err.message.includes('Transfer failed') || err.message.includes('Access denied') || !device.opened) {
              console.log("Attempting reconnection/reset...");
              try {
                  // Try to close and re-open to clear stall
                  try { await device.close(); } catch(e) {}
                  await device.open();
                  await device.selectConfiguration(1);
                  try { await device.claimInterface(0); } catch(e) {}
                  
                  // Retry Transfer
                  let endpointNumber = 1;
                  if (device.configuration?.interfaces?.[0]?.alternates?.[0]?.endpoints) {
                      const ep = device.configuration.interfaces[0].alternates[0].endpoints.find((e: any) => e.direction === 'out');
                      if (ep) endpointNumber = ep.endpointNumber;
                  }
                  
                  await device.transferOut(endpointNumber, data);
                  return true;
              } catch (retryErr: any) {
                  console.error("Retry failed:", retryErr);
                  
                  // Check for access denied during retry
                  if (retryErr.name === 'SecurityError' || retryErr.message?.includes('Access denied')) {
                      setError("Printer Access Denied. Windows driver may have reclaimed the device.");
                  } else {
                      setError("Print failed. Connection lost.");
                  }
                  
                  setDevice(null); // Force user to reconnect manually
                  return false;
              }
          }

          setError("Print error: " + err.message);
          return false;
      }
  }

  const printOrder = async (order: Order): Promise<boolean> => {
      try {
          const data = generateOrderReceipt(order);
          return await sendToPrinter(data);
      } catch (e) {
          console.error("Failed to generate order receipt", e);
          return false;
      }
  };

  const printTest = async (): Promise<boolean> => {
      try {
          const data = generateTestReceipt();
          return await sendToPrinter(data);
      } catch (e) {
          console.error("Failed to generate test receipt", e);
          return false;
      }
  };

  return (
    <PrinterContext.Provider value={{
      device,
      isConnected: !!device, 
      connectPrinter,
      disconnectPrinter,
      printOrder,
      printTest,
      error
    }}>
      {children}
    </PrinterContext.Provider>
  );
};

export const usePrinter = () => {
  const context = useContext(PrinterContext);
  if (context === undefined) {
    throw new Error('usePrinter must be used within a PrinterProvider');
  }
  return context;
};