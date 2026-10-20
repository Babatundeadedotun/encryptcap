import { useEffect } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppHeader, SiteFooter, SiteHeader } from './components/Chrome';
import { Spinner } from './components/ui';
import { useAuth } from './session/AuthContext';

import Home from './pages/public/Home';
import About from './pages/public/About';
import Pricing from './pages/public/Pricing';
import Reports from './pages/public/Reports';
import ArticlePage from './pages/public/ArticlePage';
import OpenAccount from './pages/public/OpenAccount';
import Login from './pages/public/Login';
import AdminLogin from './pages/public/AdminLogin';

import InvestorDesk from './pages/app/InvestorDesk';
import ManagerConsole from './pages/manager/ManagerConsole';
import NewAccount from './pages/manager/NewAccount';
import AccountEditor from './pages/manager/AccountEditor';
import RequestQueue from './pages/manager/RequestQueue';
import Security from './pages/manager/Security';
import { ResearchEditor, ResearchList } from './pages/manager/ResearchAdmin';

/** Scroll to the top on navigation, matching the prototype's behaviour. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PublicLayout() {
  return (
    <>
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </>
  );
}

function AppLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
      <SiteFooter />
    </>
  );
}

/** Requires a session; optionally a specific role. */
function Protected({ role }: { role?: 'manager' | 'investor' }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session…" />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Signed in but on the wrong side of the app — send them to their own home
  // rather than showing an error.
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'manager' ? '/app/manager' : '/app/investor'} replace />;
  }

  return <Outlet />;
}

function NotFound() {
  return (
    <div className="wrap">
      <section className="sect" style={{ paddingTop: 60, maxWidth: 640 }}>
        <div className="eyebrow">404</div>
        <h1 className="big">That page doesn’t exist.</h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          The link may be out of date. Everything is reachable from the home page.
        </p>
        <Link className="btn-nav" to="/">
          Go home
        </Link>
      </section>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:slug" element={<ArticlePage />} />
          <Route path="/open" element={<OpenAccount />} />
          <Route path="/login" element={<Login />} />
          {/* Staff door. Deliberately unlinked — reached by typing the address. */}
          <Route path="/admin" element={<AdminLogin />} />
        </Route>

        <Route element={<AppLayout />}>
          <Route element={<Protected role="investor" />}>
            <Route path="/app/investor" element={<InvestorDesk />} />
          </Route>

          <Route element={<Protected role="manager" />}>
            <Route path="/app/manager" element={<ManagerConsole />} />
            <Route path="/app/manager/accounts/new" element={<NewAccount />} />
            <Route path="/app/manager/accounts/:id" element={<AccountEditor />} />
            <Route path="/app/manager/requests" element={<RequestQueue />} />
            <Route path="/app/manager/security" element={<Security />} />
            <Route path="/app/manager/reports" element={<ResearchList />} />
            <Route path="/app/manager/reports/new" element={<ResearchEditor />} />
            <Route path="/app/manager/reports/:id" element={<ResearchEditor />} />
          </Route>
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
