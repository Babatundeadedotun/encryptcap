import { useMemo, useState } from 'react';
import { api } from '../api/client';
import type { AccountView, CapitalAction } from '../api/types';
import { C, EMAIL } from '../lib/constants';
import { formatAmountInput, money, parseAmount } from '../lib/format';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface Props {
  action: CapitalAction;
  account: AccountView;
  onClose: () => void;
}

/** The summary rows shown above the form, per action. */
function summaryRows(action: CapitalAction, account: AccountView): Array<[string, string]> {
  const { position, nextDistributionLabel, depositedCapital } = account;

  switch (action) {
    case 'Withdraw all':
      return [
        ['Current equity', money(position.equity)],
        ['Est. management fee', `${money(position.fee)} (33.3% of profit)`],
        ['Est. amount to you', money(position.equity - position.fee)],
        ['Settles at', `${nextDistributionLabel} review`],
      ];
    case 'Withdraw profit only':
      return [
        ['Profit above deposit', money(position.feeable)],
        ['Your share (66.7%)', money(position.investorShare)],
        ['Management fee (33.3%)', money(position.fee)],
        ['Capital stays working', money(depositedCapital)],
        ['Settles at', `${nextDistributionLabel} review`],
      ];
    case 'Compound':
      return [
        ['Profit share to reinvest', money(position.investorShare)],
        ['New working base', money(depositedCapital + position.investorShare)],
        ['Effective from', `${nextDistributionLabel} review`],
      ];
    case 'Increase allocation':
      return [
        ['Current capital', money(depositedCapital)],
        ['Tier minimum top-up', 'Any amount'],
        ['Deployed', 'Next trading window'],
      ];
  }
}

function defaultAmount(action: CapitalAction, account: AccountView): string {
  const { position } = account;
  switch (action) {
    case 'Withdraw all':
      return formatAmountInput(Math.round(position.equity - position.fee));
    case 'Withdraw profit only':
    case 'Compound':
      return formatAmountInput(Math.round(position.investorShare));
    case 'Increase allocation':
      return '';
  }
}

export function CapitalActionSheet({ action, account, onClose }: Props) {
  const [name, setName] = useState(account.investorName);
  const [amount, setAmount] = useState(() => defaultAmount(action, account));
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const rows = useMemo(() => summaryRows(action, account), [action, account]);
  const complete = Boolean(name.trim() && amount.trim());
  const amountLabel = action === 'Increase allocation' ? 'Additional amount (USD)' : 'Amount (USD)';

  const onCompose = async () => {
    if (!complete || busy) return;
    setBusy(true);

    // Log the request so it reaches the manager's queue even if the email is
    // never actually sent. A failure here must not block the email itself.
    try {
      await api.capitalRequests.create({
        action,
        contactName: name.trim(),
        amount: parseAmount(amount) || 0,
      });
    } catch {
      toast('We couldn’t log this request, but your email is still ready to send.');
    }

    const body = `Hello Encrypt Capital,

I'd like to request: ${action}

Full name: ${name.trim()}
Account: ${account.reference}
Tier: ${account.tierLabel} — ${account.tierCycle} cycle
${amountLabel}: $${amount.trim()}
Current equity: ${money(account.position.equity)}
Next review: ${account.nextDistributionLabel}

Please confirm the details and settlement date.

Thank you.`;

    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(
      `${action} — ${name.trim()} (${account.reference})`,
    )}&body=${encodeURIComponent(body)}`;

    setBusy(false);
    onClose();
    toast('Email drafted — press send in your mail app to submit the request.');
  };

  return (
    <Modal open onClose={onClose} labelledBy="capital-action-title">
      <h3 id="capital-action-title">{action}</h3>
      <p className="sub2">
        Confirm your name and the figure, then compose the email request. Nothing moves until our
        team confirms with you — requests settle at your next review cycle.
      </p>

      {rows.map(([label, value]) => (
        <div className="srow" key={label}>
          <span>{label}</span>
          <span>{value}</span>
        </div>
      ))}

      <div style={{ borderTop: `1px solid ${C.lineSoft}`, marginTop: 4, paddingTop: 14 }}>
        <div className="field">
          <label htmlFor="ca-name">
            Full name <em style={{ color: C.red, fontStyle: 'normal' }}>*</em>
          </label>
          <input
            id="ca-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field" style={{ marginBottom: 4 }}>
          <label htmlFor="ca-amt">
            {amountLabel} <em style={{ color: C.red, fontStyle: 'normal' }}>*</em>
          </label>
          <input
            id="ca-amt"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 1,500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="hint">
            {action === 'Increase allocation'
              ? 'How much you want to add to your allocation.'
              : 'Indicative — the final figure is confirmed at settlement.'}
          </div>
        </div>
      </div>

      <div className="cta">
        <button className="btn-mail" onClick={onCompose} disabled={!complete || busy}>
          {busy ? 'Preparing…' : 'Compose email request'}
        </button>
        <button className="btn-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className="mailhint">
        Opens your email app addressed to <a href={`mailto:${EMAIL}`}>{EMAIL}</a> with these details
        pre-filled — all you do is press send.
      </div>
    </Modal>
  );
}
