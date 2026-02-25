import React, { createContext, useContext, useRef } from 'react';
import Toast, { ToastRef, ToastType } from '../components/ui/Toast';

interface ToastContextType {
    show: (message: string, type?: ToastType, duration?: number) => void;
    hide: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const toastRef = useRef<ToastRef>(null);

    const show = (message: string, type?: ToastType, duration?: number) => {
        toastRef.current?.show(message, type, duration);
    };

    const hide = () => {
        toastRef.current?.hide();
    };

    return (
        <ToastContext.Provider value={{ show, hide }}>
            {children}
            <Toast ref={toastRef} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
