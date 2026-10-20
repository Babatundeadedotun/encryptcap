import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ADDRESS, C, EMAIL, RC, SHOW_STRIP, SOCIAL_LINKS } from '../lib/constants';
import { useAuth } from '../session/AuthContext';
import { useToast } from './Toast';

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="12" fill={C.ink} />
      <path d="M8 9h10M8 13h7M8 17h10" stroke={C.gold} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Brand() {
  return (
    <Link className="brand" to="/">
      <Logo />
      <b>
        Encrypt<span>Capital</span>
      </b>
    </Link>
  );
}

function tabClass({ isActive }: { isActive: boolean }) {
  return `tab${isActive ? ' on' : ''}`;
}

/** Public marketing header. */
export function SiteHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const onLogout = async () => {
    await logout();
    toast('Logged out.');
    navigate('/');
  };

  return (
    <>
      {SHOW_STRIP && (
        <div className="strip">
          Trading global markets carries risk. <b>Risk-managed, not risk-free</b> — automated
          controls on every trade.
        </div>
      )}
      <div className="top">
        <div className="top-in">
          <Brand />
          <nav className="tabs" aria-label="Site">
            <NavLink className={tabClass} to="/" end>
              Home
            </NavLink>
            <NavLink className={tabClass} to="/about">
              About Us
            </NavLink>
            <NavLink className={tabClass} to="/pricing">
              Pricing
            </NavLink>
            <NavLink className={tabClass} to="/reports">
              Reports
            </NavLink>

            {/*
              The signed-in area belongs in the navigation, not tucked into the
              account corner. Which link appears is decided by the role on the
              server-issued session: a manager gets the console, an investor
              never sees it. The link is only the signpost — /app/manager is
              guarded by the route check and every manager endpoint answers 403
              to an investor, so nothing here is load-bearing for access.
            */}
            {user && (
              <>
                <span className="tab-sep" aria-hidden="true" />
                {user.role === 'manager' ? (
                  <NavLink className={tabClass} to="/app/manager">
                    Manager Console
                  </NavLink>
                ) : (
                  <NavLink className={tabClass} to="/app/investor">
                    My Account
                  </NavLink>
                )}
              </>
            )}
          </nav>
          <div className="top-cta">
            {user ? (
              <>
                <span className="who">
                  {user.role === 'manager' && <span className="role-badge">Staff</span>}
                  {user.name}
                </span>
                <button className="btn-nav ghost" onClick={onLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link className="btn-nav ghost" to="/login">
                  Log in
                </Link>
                <Link className="btn-nav" to="/open">
                  Open an account
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Signed-in header for the investor desk and manager console. */
export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isManager = user?.role === 'manager';

  const onLogout = async () => {
    await logout();
    toast('Logged out.');
    navigate('/');
  };

  return (
    <div className="top">
      <div className="top-in">
        <Brand />
        <nav className="tabs" aria-label="Product">
          {isManager ? (
            <>
              <NavLink className={tabClass} to="/app/manager" end>
                Manager Console
              </NavLink>
              <NavLink className={tabClass} to="/app/manager/requests">
                Requests
              </NavLink>
              <NavLink className={tabClass} to="/app/manager/reports">
                Research
              </NavLink>
              <NavLink className={tabClass} to="/app/manager/security">
                Security
              </NavLink>
            </>
          ) : (
            <NavLink className={tabClass} to="/app/investor" end>
              My Account
            </NavLink>
          )}
          <span className="tab-sep" aria-hidden="true" />
          <NavLink className={tabClass} to="/reports">
            Reports
          </NavLink>
          <NavLink className={tabClass} to="/" end>
            Public site
          </NavLink>
        </nav>
        <div className="top-cta">
          <span className="who">
            {isManager && <span className="role-badge">Staff</span>}
            {user?.name ?? 'Investor'}
          </span>
          <button className="btn-nav ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="foot-in">
        <div className="foot-grid">
          <div>
            <h4>Encrypt Capital</h4>
            <Link to="/about">About Us</Link>
            <Link to="/">Our strategy</Link>
            <Link to="/about#contact">Contact</Link>
          </div>
          <div>
            <h4>Investing</h4>
            <Link to="/pricing">Pricing &amp; tiers</Link>
            <Link to="/pricing">100X Portfolio</Link>
            <Link to="/pricing">Consortium</Link>
            <Link to="/pricing">Private / Gold</Link>
          </div>
          <div>
            <h4>Investors</h4>
            <Link to="/login">Log in</Link>
            <Link to="/reports">Reports</Link>
            <Link to="/open">Open an account</Link>
          </div>
          <div>
            <h4>Legal</h4>
            <Link to="/reports">Risk disclosure</Link>
            <Link to="/about">Terms of service</Link>
            <Link to="/about">Privacy policy</Link>
          </div>
          {SOCIAL_LINKS.length > 0 && (
            <div>
              <h4>Follow</h4>
              {SOCIAL_LINKS.map((s) => (
                <a key={s.label} href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="legal">
          <b>Encrypt Capital Ltd. (RC {RC})</b> · {ADDRESS} ·{' '}
          <a href={`mailto:${EMAIL}`} style={{ color: C.blueDeep }}>
            {EMAIL}
          </a>
          <br />
          Trading financial instruments in the global markets carries a high level of risk and may
          not be suitable for every investor. You can lose some or all of your capital. Past
          performance is not a reliable indicator of future results. Nothing on this website is
          financial advice or an offer of guaranteed returns.
          <br />© 2026 Encrypt Capital Ltd. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
