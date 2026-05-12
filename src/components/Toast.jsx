import { useEffect, useState } from 'react';
import { XCircle, CheckCircle, Info } from 'lucide-react';

// Un simple sistema de Toast no global para la demo. 
// En una app real se usaría algo como react-hot-toast o un store global de toasts.

export const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const styles = {
    success: 'bg-dark-700 border border-platzi-green/30 text-platzi-green',
    error: 'bg-dark-700 border border-red-500/30 text-red-400',
    info: 'bg-dark-700 border border-blue-500/30 text-blue-400',
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-xl animate-slide-up ${styles[type]}`}>
      {icons[type]}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70 transition-opacity">
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
};
