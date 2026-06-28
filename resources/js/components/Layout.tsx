import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  FileText, FilePlus, Upload, BarChart3, Building2, Users, LogOut, Leaf, Database, type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}
interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    section: '販売管理',
    items: [
      { to: '/', label: '見積書一覧', icon: FileText, end: true },
      { to: '/quotes/new', label: '見積書作成', icon: FilePlus },
      { to: '/import', label: '見積書取込', icon: Upload },
      { to: '/summary', label: '月末集計', icon: BarChart3 },
    ],
  },
  {
    section: 'マスタ管理',
    items: [
      { to: '/sender-profiles', label: '基本情報マスタ', icon: Building2 },
      { to: '/customers', label: '取引先マスタ', icon: Users },
      { to: '/data', label: 'データ管理', icon: Database },
    ],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-neutral-100">
      {/* Sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 flex w-60 flex-col border-r border-neutral-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-white">
            <Leaf size={18} />
          </div>
          <span className="text-lg font-bold tracking-tight text-neutral-800">ZenSales</span>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {group.section}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 rounded-[12px] px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        )
                      }
                    >
                      <item.icon size={18} />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-neutral-100 p-3">
          {user && (
            <div className="mb-2 px-3 py-1 text-xs text-neutral-400 truncate">{user.email}</div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            <LogOut size={18} />
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 pl-60 print:pl-0">
        <div className="mx-auto max-w-6xl px-8 py-8 print:max-w-none print:p-0">{children}</div>
      </main>
    </div>
  );
}
