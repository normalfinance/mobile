import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Toast } from '@/components/ui/Toast';

interface ToastConfig {
  message: string;
  type?: 'success' | 'error' | 'info';
  actionText?: string;
  onActionPress?: () => void;
  duration?: number;
}

interface ToastContextType {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = (config: ToastConfig) => {
    setToastConfig(config);
    setVisible(true);
  };

  const hideToast = () => {
    setVisible(false);
    // Clear config after animation completes
    setTimeout(() => setToastConfig(null), 300);
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toastConfig && (
        <Toast
          visible={visible}
          message={toastConfig.message}
          type={toastConfig.type}
          actionText={toastConfig.actionText}
          onActionPress={toastConfig.onActionPress}
          onDismiss={hideToast}
          duration={toastConfig.duration}
        />
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};