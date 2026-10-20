import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { C } from '../../lib/constants';
import { Eyebrow, ErrorNote, Field } from '../../components/ui';
import { useAuth } from '../../session/AuthContext';
import { useToast } from '../../components/Toast';
import { api } from '../../api/client';

/**
 * Staff sign-in, at /admin.
 *
 * Nothing on the site links here — it is reached by typing the address. That is
 * the point: an admin door that is advertised in the navigation invites
 * password-guessing from every passing bot. Obscurity is not the protection
 * though; the protections are the password, the rate limit on the endpoint, and
 * the server refusing a non-manager at this door whatever the browser sends.
 */
export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The recovery panel replaces the sign-in form rather than sitting beside it,
  // so there is never a question of which password field is which.
  const [recovering, setRecovering] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recovered, setRecovered] = useState<number | null>(null);

  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  /*
   * Keep this page out of search results. There is a Disallow in robots.txt as
   * well, but that only asks crawlers not to *fetch* it — a crawler that finds
   * the address elsewhere can still list it. This tag is what says don't index.
   */
  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex, nofollow';
    document.head.appendChild(tag);

    const previousTitle = document.title;
    document.title = 'Staff access — Encrypt Capital';

    return () => {
      tag.remove();
      document.title = previousTitle;
    };
  }, []);

  // Already signed in: send each role where it belongs rather than showing a
  // sign-in form to someone who is holding a session.
  if (!loading && user) {
    return <Navigate to={user.role === 'manager' ? '/app/manager' : '/app/investor'} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      // The 'staff' scope is what makes the server apply the manager-only rule.
      await login(email.trim(), password, 'staff');
      toast('Signed in to the console.');
      navigate('/app/manager', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  };

  const onRecover = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 10) {
      setError('Use at least 10 characters for the new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Those two passwords don’t match.');
      return;
    }

    setBusy(true);
    try {
      const { remaining } = await api.auth.recover(email.trim(), code, newPassword);
      // No session is handed out here on purpose — the new password has to be
      // used at the sign-in form, which is one more thing an attacker would
      // need rather than a free way in.
      setRecovered(remaining);
      setRecovering(false);
      setPassword('');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password set. Sign in with it now.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that code.');
    } finally {
      setBusy(false);
    }
  };

  if (recovering) {
    return (
      <div className="wrap">
        <div className="auth">
          <Eyebrow>Staff access</Eyebrow>
          <h2 className="head">Use a recovery code</h2>
          <p className="sub" style={{ marginBottom: 20 }}>
            Each code works once. Using one sets a new password and signs out every device that
            is currently holding a session.
          </p>

          <form className="panel" onSubmit={onRecover}>
            {error && <ErrorNote>{error}</ErrorNote>}

            <Field id="r-email" label="Staff email address">
              <input
                id="r-email"
                type="email"
                autoComplete="email"
                placeholder="manager@encryptcap.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>

            <Field id="r-code" label="Recovery code">
              <input
                id="r-code"
                type="text"
                autoComplete="one-time-code"
                placeholder="4F2K-9QX7-MM31"
                className="mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <div className="hint">Dashes and capitals are optional.</div>
            </Field>

            <Field id="r-new" label="New password">
              <input
                id="r-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <div className="hint">At least 10 characters.</div>
            </Field>

            <Field id="r-confirm" label="Confirm new password">
              <input
                id="r-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </Field>

            <button className="btn-block" type="submit" disabled={busy}>
              {busy ? 'Setting password…' : 'Set new password'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: 12.5, color: C.textMute }}>
            <button
              className="authlink"
              onClick={() => {
                setRecovering(false);
                setError(null);
              }}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="auth">
        <Eyebrow>Staff access</Eyebrow>
        <h2 className="head">
          Manager Console{' '}
          <span className="role-badge" style={{ verticalAlign: 'middle' }}>
            Staff
          </span>
        </h2>
        <p className="sub" style={{ marginBottom: 20 }}>
          Sign in to manage the book, settle capital requests and publish research.
        </p>

        <form className="panel" onSubmit={onSubmit}>
          {error && <ErrorNote>{error}</ErrorNote>}

          {recovered !== null && (
            <div className="hwm-note" role="status">
              <b>Password set.</b> Sign in with it below. {recovered}{' '}
              {recovered === 1 ? 'recovery code remains' : 'recovery codes remain'} — generate a
              fresh set from the console once you are back in.
            </div>
          )}

          <Field id="a-email" label="Staff email address">
            <input
              id="a-email"
              type="email"
              autoComplete="email"
              placeholder="manager@encryptcap.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field id="a-pass" label="Password">
            <input
              id="a-pass"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          <button className="btn-block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in to console'}
          </button>

          <div className="hint" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="authlink" onClick={() => setRecovering(true)}>
              Lost access?
            </button>
          </div>

          <div className="mailhint">
            Staff accounts are issued internally. If you are locked out, use one of your
            recovery codes above.
          </div>
        </form>

        <div style={{ textAlign: 'center', fontSize: 12.5, color: C.textMute }}>
          Investor?{' '}
          <Link className="authlink" to="/login">
            Sign in here instead
          </Link>
        </div>
      </div>
    </div>
  );
}
