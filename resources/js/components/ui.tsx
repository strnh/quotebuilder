import {
  createContext, useContext, useState, useCallback,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes,
  type SelectHTMLAttributes, type HTMLAttributes, type ReactNode, type ComponentType,
} from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

// ---------- Button ----------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outlineDanger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-sm hover:bg-primary-600 active:bg-primary-700',
  secondary: 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50',
  ghost: 'text-neutral-600 hover:bg-neutral-100',
  danger: 'bg-danger text-white hover:opacity-90',
  outlineDanger: 'border border-danger/40 text-danger hover:bg-danger/5',
};
const BTN_SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}
export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center rounded-[16px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        className
      )}
      {...props}
    />
  );
}

// ---------- Card ----------
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('bg-white rounded-[24px] shadow-md', className)} {...props} />;
}

// ---------- Field / Input / Select / Textarea ----------
interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}
export function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      {label && (
        <span className="block mb-1 text-xs font-medium text-neutral-600">
          {label} {required && <span className="text-danger">*</span>}
        </span>
      )}
      {children}
      {hint && <span className="block mt-1 text-xs text-neutral-400">{hint}</span>}
      {error && <span className="block mt-1 text-xs text-danger">{error}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-[8px] border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(inputCls, className)} {...props} />;
}
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(inputCls, 'min-h-[80px] resize-y', className)} {...props} />;
}
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(inputCls, 'appearance-none bg-no-repeat', className)} {...props}>
      {children}
    </select>
  );
}

// ---------- Badge ----------
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {children}
    </span>
  );
}

// ---------- Modal ----------
type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
}
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!open) return null;
  const w: Record<ModalSize, string> = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:py-10">
      <div className={clsx('w-full rounded-[24px] bg-white shadow-lg', w[size])}>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h3 className="text-base font-bold text-neutral-800">{title}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Toast ----------
type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: string;
  message: string;
  type: ToastType;
}
type PushToast = (message: string, type?: ToastType) => void;

const ToastContext = createContext<PushToast | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback<PushToast>((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'rounded-[16px] px-4 py-3 text-sm font-medium text-white shadow-xl',
              t.type === 'success' && 'bg-success',
              t.type === 'error' && 'bg-danger',
              t.type === 'info' && 'bg-info'
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast(): PushToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ---------- Empty state ----------
interface EmptyStateProps {
  icon?: ComponentType<{ size?: number; className?: string }>;
  title: ReactNode;
  children?: ReactNode;
}
export function EmptyState({ icon: Icon, title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={40} className="mb-3 text-neutral-300" />}
      <p className="text-sm font-medium text-neutral-500">{title}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
