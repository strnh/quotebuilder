import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell';
import { Button, Input, Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('パスワードが一致しません。');
      return;
    }
    setBusy(true);
    try {
      await register(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="アカウント作成" subtitle="新規登録してはじめる">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-[8px] bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>}
        <Field label="メールアドレス">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label="パスワード">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </Field>
        <Field label="パスワード（確認）">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? '作成中...' : 'アカウント作成'}</Button>
      </form>
      <p className="mt-5 text-center text-xs text-neutral-500">
        既にアカウントをお持ちですか？{' '}
        <Link to="/login" className="font-medium text-primary-600 hover:underline">ログイン</Link>
      </p>
    </AuthShell>
  );
}
