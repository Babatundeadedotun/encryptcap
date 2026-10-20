import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { Article } from '../../api/types';
import { ARTICLE_CATEGORIES, C } from '../../lib/constants';
import { Eyebrow, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';

export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link className="art" to={`/reports/${article.slug}`}>
      <span className="cat">{article.category}</span>
      <span className="t">{article.title}</span>
      <span className="dek">{article.dek}</span>
      <span className="meta">
        {article.minutes} min read ·{' '}
        {article.publishedAt
          ? new Date(article.publishedAt).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })
          : 'Draft'}
        {article.assets.map((asset) => (
          <span className="doc" key={asset.id}>
            {asset.kind}
          </span>
        ))}
      </span>
      <span className="go">Read summary →</span>
    </Link>
  );
}

export default function Reports() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [category, setCategory] = useState<string>('All');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    setArticles(null);
    setError(null);

    api.articles
      .list(category)
      .then(({ articles: list }) => {
        if (!cancelled) setArticles(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setArticles([]);
          setError(err instanceof Error ? err.message : 'Could not load reports.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  const onNotify = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast('That doesn’t look like an email address.');
      return;
    }

    setBusy(true);
    try {
      await api.subscribers.join(email.trim());
      setEmail('');
      toast('You’re on the list. We’ll email you the moment the next report drops.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add you to the list.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <section className="sect" style={{ paddingTop: 44 }}>
        <Eyebrow>Reports</Eyebrow>
        <h1 className="big">Research, in plain language.</h1>
        <p className="sub" style={{ fontSize: 15 }}>
          We publish short reads on the markets we trade and the assets our investors keep asking
          about. Each one is a quick summary — and each links to the full study you can download and
          keep.
        </p>
        <p className="sub" style={{ fontSize: 12.5, color: C.textFaint, marginTop: 8 }}>
          No jargon walls. No paywalls. New pieces drop when we have something worth saying.
        </p>
      </section>

      <section className="sect-tight">
        <div
          className="panel"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>
              Get new research in your inbox.
            </div>
            <div style={{ fontSize: 12.5, color: C.textMute, marginTop: 3, lineHeight: 1.5 }}>
              We publish at irregular intervals — one email per release, nothing else.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260, maxWidth: 420 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              style={{
                flex: 1,
                border: `1px solid ${C.line}`,
                borderRadius: 9,
                padding: '11px 13px',
                fontSize: 13.5,
                fontFamily: 'inherit',
                background: C.surface,
                color: C.ink,
              }}
            />
            <button
              className="btn-nav"
              onClick={onNotify}
              disabled={busy}
              style={{ padding: '11px 18px' }}
            >
              {busy ? 'Adding…' : 'Notify me'}
            </button>
          </div>
        </div>
      </section>

      <section className="sect-tight">
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
          {ARTICLE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`chip${category === cat ? ' on' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {articles === null ? (
          <Spinner label="Loading research…" />
        ) : error ? (
          <div className="panel" style={{ textAlign: 'center', padding: '38px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.ink, marginBottom: 5 }}>
              We couldn’t load the research just now.
            </div>
            <div style={{ fontSize: 13, color: C.textMute }}>{error}</div>
          </div>
        ) : articles.length ? (
          <div className="grid2">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="panel" style={{ textAlign: 'center', padding: '38px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.ink, marginBottom: 5 }}>
              Nothing here under this topic yet.
            </div>
            <div style={{ fontSize: 13, color: C.textMute }}>
              Try another topic, or see everything under{' '}
              <button className="authlink" onClick={() => setCategory('All')}>
                All
              </button>
              .
            </div>
          </div>
        )}
      </section>

      <section className="sect" style={{ maxWidth: 720 }}>
        <div className="riskfoot">
          For information only. Not investment advice or a recommendation to buy, sell, or hold any
          asset. All investing carries risk, and you can lose money.
        </div>
      </section>
    </div>
  );
}
