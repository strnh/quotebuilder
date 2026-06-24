import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell';
import { Button, Input, Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="おかえりなさい" subtitle="アカウントにログイン">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-[8px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>}
        <Field label="メールアドレス">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label="パスワード">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </Field>
        <div className="text-right">
          <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">パスワードをお忘れですか？</Link>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'ログイン中...' : 'ログイン'}</Button>
      </form>
      <p className="mt-5 text-center text-xs text-neutral-500">
        アカウントをお持ちでないですか？{' '}
        <Link to="/register" className="font-medium text-primary-600 hover:underline">新規作成</Link>
      </p>
    </AuthShell>
  );
}
