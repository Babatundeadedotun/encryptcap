import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { C } from '../../lib/constants';
import { Eyebrow, ErrorNote, Field } from '../../components/ui';
import { useAuth } from '../../session/AuthContext';
import { useToast } from '../../components/Toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const user = await login(email.trim(), password);
      toast('Logged in.');

      const from = (location.state as { from?: string } | null)?.from;
      const home = user.role === 'manager' ? '/app/manager' : '/app/investor';
      navigate(from && from.startsWith('/app') ? from : home, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log you in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <div className="auth">
        <Eyebrow>Investor Portal</Eyebrow>
        <h2 className="head">Welcome back.</h2>
        <p className="sub" style={{ marginBottom: 20 }}>
          Log in to see your equity, statements and next distribution.
        </p>

        <form className="panel" onSubmit={onSubmit}>
          {error && <ErrorNote>{error}</ErrorNote>}

          <Field id="l-email" label="Email address">
            <input
              id="l-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field id="l-pass" label="Password">
            <input
              id="l-pass"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="hint" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="authlink"
                onClick={() =>
                  toast('Contact your account manager and they’ll issue a new password.')
                }
              >
                Forgot password?
              </button>
            </div>
          </Field>

          <button className="btn-block" type="submit" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>

          <div className="mailhint">
            Accounts are opened by our team. If you’ve funded an account and don’t have a login yet,
            contact us and we’ll issue one.
          </div>
        </form>

        <div style={{ textAlign: 'center', fontSize: 12.5, color: C.textMute }}>
          New to Encrypt Capital?{' '}
          <Link className="authlink" to="/open">
            Open an account
          </Link>
        </div>
      </div>
    </div>
  );
}
