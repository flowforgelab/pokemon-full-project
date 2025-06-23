import { useToast } from '@/components/ui/Toast';

export function useToastNotification() {
  const { addToast, removeToast } = useToast();

  const success = (title: string, description?: string) => {
    return addToast({
      type: 'success',
      title,
      description,
    });
  };

  const error = (title: string, description?: string) => {
    return addToast({
      type: 'error',
      title,
      description,
      duration: 7000,
    });
  };

  const warning = (title: string, description?: string) => {
    return addToast({
      type: 'warning',
      title,
      description,
    });
  };

  const info = (title: string, description?: string) => {
    return addToast({
      type: 'info',
      title,
      description,
    });
  };

  const promise = async <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    const loadingId = addToast({
      type: 'info',
      title: messages.loading,
      persistent: true,
    });

    try {
      const result = await promise;
      addToast({
        type: 'success',
        title: typeof messages.success === 'function' ? messages.success(result) : messages.success,
      });
      return result;
    } catch (err) {
      addToast({
        type: 'error',
        title: typeof messages.error === 'function' ? messages.error(err) : messages.error,
        duration: 7000,
      });
      throw err;
    } finally {
      // Remove loading toast
      removeToast(loadingId);
    }
  };

  return {
    success,
    error,
    warning,
    info,
    promise,
  };
}