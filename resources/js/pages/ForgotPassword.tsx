import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from './AuthShell';
import { Button, Input, Field } from '../components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <AuthShell title="パスワードの再設定" subtitle="登録メールアドレスを入力してください">
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-neutral-600">
            パスワード再設定の手順を <span className="font-medium">{email}</span> に送信しました。
          </p>
          <Link to="/login" className="inline-block text-sm font-medium text-primary-600 hover:underline">
            ログインに戻る
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="メールアドレス">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </Field>
          <Button type="submit" className="w-full">再設定リンクを送信</Button>
          <p className="text-center text-xs text-neutral-500">
            <Link to="/login" className="font-medium text-primary-600 hover:underline">ログインに戻る</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
