import { useState } from 'react';
import { C } from '../../lib/constants';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../session/AuthContext';
import { useToast } from '../../components/Toast';

/**
 * Nudges anyone still on a manager-issued password to pick their own.
 *
 * Dismissing it used to last only until the next render — the component is
 * mounted by both desks, so navigating between pages remounted it and the modal
 * reappeared. The choice is now remembered in sessionStorage: gone for the rest
 * of this browser session, back on the next sign-in, and replaced by a quiet
 * inline banner so it stays discoverable without nagging.
 */

const dismissKey = (userId: string) => `encryptcap:pw-prompt-dismissed:${userId}`;

function wasDismissed(userId: string): boolean {
  try {
    return sessionStorage.getItem(dismissKey(userId)) === '1';
  } catch {
    // Private browsing can throw on storage access; degrade to showing it.
    return false;
  }
}

function rememberDismissal(userId: string) {
  try {
    sessionStorage.setItem(dismissKey(userId), '1');
  } catch {
    /* not fatal — the prompt simply reappears next navigation */
  }
}

export function ChangePasswordPrompt() {
  const { user, changePassword } = useAuth();
  const [dismissed, setDismissed] = useState(() => (user ? wasDismissed(user.id) : false));
  const [done, setDone] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (!user?.mustChangePassword || done) return null;

  const dismiss = () => {
    rememberDismissal(user.id);
    setDismissed(true);
  };

  const onSubmit = async () => {
    setError(null);

    if (next.length < 10) {
      setError('Use at least 10 characters.');
      return;
    }
    if (next !== confirm) {
      setError('Those two passwords don’t match.');
      return;
    }

    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
      toast('Password changed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  // Dismissed for this session: stay out of the way, but leave a way back in.
  if (dismissed) {
    return (
      <div className="pw-banner" role="note">
        <span>
          You’re still signed in with the password we issued. Set your own whenever you’re ready.
        </span>
        <button
          className="chip"
          onClick={() => {
            setDismissed(false);
            setError(null);
          }}
        >
          Set a password
        </button>
      </div>
    );
  }

  return (
    <Modal open onClose={dismiss} labelledBy="change-password-title">
      <h3 id="change-password-title">Set your own password</h3>
      <p className="sub2">
        You’re signed in with the password we issued. Choose your own before you go further — nobody
        at Encrypt Capital can see it.
      </p>

      {error && (
        <div className="err" role="alert" style={{ display: 'block' }}>
          {error}
        </div>
      )}

      <div className="field">
        <label htmlFor="cp-current">Current password</label>
        <input
          id="cp-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="cp-new">New password</label>
        <input
          id="cp-new"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <div className="hint">At least 10 characters.</div>
      </div>
      <div className="field">
        <label htmlFor="cp-confirm">Confirm new password</label>
        <input
          id="cp-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <div className="cta">
        <button
          className="btn-mail"
          onClick={onSubmit}
          disabled={busy || !current || !next || !confirm}
          style={{ background: C.ink, color: C.onDark }}
        >
          {busy ? 'Saving…' : 'Change password'}
        </button>
        <button className="btn-cancel" onClick={dismiss}>
          Not now
        </button>
      </div>
    </Modal>
  );
}
