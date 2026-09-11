import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

export type ToastType = 'cart' | 'wishlist' | 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  id?: string;
  type?: ToastType;
  title: string;
  subtitle?: string;
  message?: string;
  duration?: number;
  icon?: string;
  thumbnail?: string;
  actionLabel?: string;
  onAction?: () => void;
  position?: 'top' | 'bottom';
}

export interface ToastContextValue {
  activeToast: ToastOptions | null;
  showToast: (options: ToastOptions | string) => void;
  hideToast: () => void;
  toast: {
    cart: (title: string, options?: Omit<ToastOptions, 'title' | 'type'>) => void;
    wishlist: (
      title: string,
      isAddedOrOptions?: boolean | Omit<ToastOptions, 'title' | 'type'>,
      options?: Omit<ToastOptions, 'title' | 'type'>
    ) => void;
    success: (
      title: string,
      messageOrOptions?: string | Omit<ToastOptions, 'title' | 'type'>,
      options?: Omit<ToastOptions, 'title' | 'type'>
    ) => void;
    error: (
      title: string,
      messageOrOptions?: string | Omit<ToastOptions, 'title' | 'type'>,
      options?: Omit<ToastOptions, 'title' | 'type'>
    ) => void;
    info: (
      title: string,
      messageOrOptions?: string | Omit<ToastOptions, 'title' | 'type'>,
      options?: Omit<ToastOptions, 'title' | 'type'>
    ) => void;
    warning: (
      title: string,
      messageOrOptions?: string | Omit<ToastOptions, 'title' | 'type'>,
      options?: Omit<ToastOptions, 'title' | 'type'>
    ) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [activeToast, setActiveToast] = useState<ToastOptions | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setActiveToast(null);
  }, []);

  const showToast = useCallback((options: ToastOptions | string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const normalized: ToastOptions = typeof options === 'string'
      ? { title: options, type: 'info' }
      : options;

    const duration = normalized.duration ?? (normalized.actionLabel ? 3500 : 2700);

    setActiveToast({
      ...normalized,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    });

    timerRef.current = setTimeout(() => {
      setActiveToast(null);
      timerRef.current = null;
    }, duration);
  }, []);

  const toast = useRef({
    cart: (_title: string, _options?: Omit<ToastOptions, 'title' | 'type'>) => {
      // Intentionally silent: toast notifications disabled across screens for add, update, delete, like
    },
    wishlist: (
      _title: string,
      _isAddedOrOptions?: boolean | Omit<ToastOptions, 'title' | 'type'>,
      _options?: Omit<ToastOptions, 'title' | 'type'>
    ) => {
      // Intentionally silent: toast notifications disabled across screens for add, update, delete, like
    },
    success: (
      title: string,
      messageOrOptions?: string | Omit<ToastOptions, 'title' | 'type'>,
      options?: Omit<ToastOptions, 'title' | 'type'>
    ) => {
      let msg: string | undefined;
      let opts: Omit<ToastOptions, 'title' | 'type'> | undefined = options;
      if (typeof messageOrOptions === 'string') {
        msg = messageOrOptions;
      } else if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
        opts = messageOrOptions;
      }

      showToast({
        title,
        message: msg || opts?.message,
        type: 'success',
        icon: 'check-circle',
        ...opts,
      });
    },
    error: (
      title: string,
      messageOrOptions?: string | Omit<ToastOptions, 'title' | 'type'>,
      options?: Omit<ToastOptions, 'title' | 'type'>
    ) => {
      let msg: string | undefined;
      let opts: Omit<ToastOptions, 'title' | 'type'> | undefined = options;
      if (typeof messageOrOptions === 'string') {
        msg = messageOrOptions;
      } else if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
        opts = messageOrOptions;
      }

      showToast({
        title,
        message: msg || opts?.message,
        type: 'error',
        icon: 'alert-circle',
        ...opts,
      });
    },
    info: (
      title: string,
      messageOrOptions?: string | Omit<ToastOptions, 'title' | 'type'>,
      options?: Omit<ToastOptions, 'title' | 'type'>
    ) => {
      let msg: string | undefined;
      let opts: Omit<ToastOptions, 'title' | 'type'> | undefined = options;
      if (typeof messageOrOptions === 'string') {
        msg = messageOrOptions;
      } else if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
        opts = messageOrOptions;
      }

      showToast({
        title,
        message: msg || opts?.message,
        type: 'info',
        icon: 'information',
        ...opts,
      });
    },
    warning: (
      title: string,
      messageOrOptions?: string | Omit<ToastOptions, 'title' | 'type'>,
      options?: Omit<ToastOptions, 'title' | 'type'>
    ) => {
      let msg: string | undefined;
      let opts: Omit<ToastOptions, 'title' | 'type'> | undefined = options;
      if (typeof messageOrOptions === 'string') {
        msg = messageOrOptions;
      } else if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
        opts = messageOrOptions;
      }

      showToast({
        title,
        message: msg || opts?.message,
        type: 'warning',
        icon: 'alert',
        ...opts,
      });
    },
  }).current;

  return (
    <ToastContext.Provider value={{ activeToast, showToast, hideToast, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
