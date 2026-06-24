import { Leaf } from 'lucide-react';
import type { ReactNode } from 'react';

interface AuthShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}

export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] bg-primary text-white">
            <Leaf size={22} />
          </div>
          <h1 className="text-xl font-bold text-neutral-800">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        </div>
        <div className="rounded-[24px] bg-white p-6 shadow-md">{children}</div>
      </div>
    </div>
  );
}
