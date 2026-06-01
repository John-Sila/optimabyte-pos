import { toast } from 'sonner';

export type ToastOptions = {
  duration?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
};

export const notify = {
  success: (message: string, options?: ToastOptions) => 
    toast.success(message, options),
  
  error: (message: string, options?: ToastOptions) => 
    toast.error(message, options),
  
  info: (message: string, options?: ToastOptions) => 
    toast.info(message, options),
  
  warning: (message: string, options?: ToastOptions) => 
    toast.warning(message, options),
  
  message: (message: string, options?: ToastOptions) => 
    toast(message, options),

  loading: (message: string, options?: ToastOptions) => {
    return toast.loading(message, options);
  },

  promise: function<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string;
    }
  ) {
    return toast.promise(promise, messages);
  },

  custom: function(
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' | 'loading',
    options?: ToastOptions
  ) {
    return toast[type](message, options);
  },

  dismiss: (toastId: string | number) => {
    toast.dismiss(toastId);
  },

  dismissAll: () => {
    toast.dismiss();
  },
};

export default notify;