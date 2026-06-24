import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AuthUser } from '../types';

// モック認証（メール/パスワードのみ）。
// localStorage にユーザーとセッションを保持。バックエンド連携は v2 で差し替え。
const NS = 'zensales';

interface StoredUser extends AuthUser {
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUsers(): StoredUser[] {
  try {
    return (JSON.parse(localStorage.getItem(`${NS}:users`) ?? 'null') as StoredUser[]) ?? [];
  } catch {
    return [];
  }
}
function writeUsers(u: StoredUser[]): void {
  localStorage.setItem(`${NS}:users`, JSON.stringify(u));
}
function readSession(): AuthUser | null {
  try {
    return (JSON.parse(localStorage.getItem(`${NS}:session`) ?? 'null') as AuthUser) ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readSession());

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const users = readUsers();
    const found = users.find((u) => u.email === email && u.password === password);
    if (!found) {
      // デモ簡略化: 未登録でもメール/パスワードが入っていればログイン可
      if (email && password) {
        const demo: AuthUser = { id: 'demo', email, full_name: email.split('@')[0] };
        localStorage.setItem(`${NS}:session`, JSON.stringify(demo));
        setUser(demo);
        return demo;
      }
      throw new Error('メールアドレスまたはパスワードが正しくありません。');
    }
    const session: AuthUser = { id: found.id, email: found.email, full_name: found.full_name };
    localStorage.setItem(`${NS}:session`, JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const register = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const users = readUsers();
    if (users.some((u) => u.email === email)) {
      throw new Error('このメールアドレスは既に登録されています。');
    }
    const u: StoredUser = { id: 'u_' + Date.now(), email, password, full_name: email.split('@')[0] };
    users.push(u);
    writeUsers(users);
    const session: AuthUser = { id: u.id, email: u.email, full_name: u.full_name };
    localStorage.setItem(`${NS}:session`, JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const logout = useCallback((): void => {
    localStorage.removeItem(`${NS}:session`);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
