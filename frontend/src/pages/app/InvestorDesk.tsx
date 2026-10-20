import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { AccountView } from '../../api/types';
import { AccountDesk } from '../../components/AccountDesk';
import { Spinner } from '../../components/ui';
import { C, EMAIL } from '../../lib/constants';
import { ChangePasswordPrompt } from './ChangePasswordPrompt';

export default function InvestorDesk() {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.accounts
      .mine()
      .then(({ account: mine }) => {
        if (!cancelled) setAccount(mine);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your account.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="wrap" style={{ paddingTop: 22, maxWidth: 900 }}>
        <div className="panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>
            We can’t show your account right now.
          </div>
          <div style={{ fontSize: 13.5, color: C.textMute, lineHeight: 1.6 }}>
            {error}
            <br />
            If this keeps happening, email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </div>
        </div>
      </div>
    );
  }

  if (!account) return <Spinner label="Loading your account…" />;

  return (
    <div className="wrap" style={{ paddingTop: 22, maxWidth: 900 }}>
      <ChangePasswordPrompt />
      <AccountDesk account={account} />
    </div>
  );
}
