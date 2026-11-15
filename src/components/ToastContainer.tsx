/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, Zap, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    container: string;
    icon: React.ReactNode;
    title: string;
    desc: string;
  }
> = {
  success: {
    container: 'bg-[#121c18]/95 border-[#1f4d3a] shadow-[0_8px_24px_rgba(0,0,0,0.45)]',
    icon: <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0 mt-0.5" />,
    title: 'text-[#ecfdf5]',
    desc: 'text-[#a7f3d0]/80',
  },
  warning: {
    container: 'bg-[#1f1911]/95 border-[#573f18] shadow-[0_8px_24px_rgba(0,0,0,0.45)]',
    icon: <AlertTriangle className="w-4 h-4 text-[#fbbf24] shrink-0 mt-0.5" />,
    title: 'text-[#fffbeb]',
    desc: 'text-[#fde68a]/80',
  },
  error: {
    container: 'bg-[#221216]/95 border-[#63232f] shadow-[0_8px_24px_rgba(0,0,0,0.5)]',
    icon: <Zap className="w-4 h-4 text-[#fb7185] shrink-0 mt-0.5" />,
    title: 'text-[#fff1f2]',
    desc: 'text-[#fecdd3]/80',
  },
  info: {
    container: 'bg-[#141922]/95 border-[#253752] shadow-[0_8px_24px_rgba(0,0,0,0.45)]',
    icon: <Info className="w-4 h-4 text-[#38bdf8] shrink-0 mt-0.5" />,
    title: 'text-[#f0f9ff]',
    desc: 'text-[#bae6fd]/75',
  },
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-14 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-[60] flex flex-col gap-2 w-[calc(100%-1.5rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const style = VARIANT_STYLES[toast.variant];
        return (
          <div
            key={toast.id}
            role={toast.variant === 'error' || toast.variant === 'warning' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-2.5 px-3 py-2.5 rounded-lg border backdrop-blur-md transition-all duration-200 ${style.container}`}
          >
            {style.icon}
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold leading-tight ${style.title}`}>
                {toast.title}
              </div>
              {toast.description && (
                <div className={`text-[11px] leading-snug mt-0.5 break-words ${style.desc}`}>
                  {toast.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="p-0.5 rounded text-[#8b909f] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
