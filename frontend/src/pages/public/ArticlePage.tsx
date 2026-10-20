import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Article } from '../../api/types';
import { C } from '../../lib/constants';
import { fileSize } from '../../lib/format';
import { Eyebrow, Spinner, Texture } from '../../components/ui';
import { ArticleCard } from './Reports';

export default function ArticlePage() {
  const { slug = '' } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setArticle(null);
    setNotFound(false);
    window.scrollTo(0, 0);

    api.articles
      .get(slug)
      .then(({ article: found }) => {
        if (!cancelled) setArticle(found);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });

    api.articles
      .list()
      .then(({ articles }) => {
        if (!cancelled) setRelated(articles.filter((a) => a.slug !== slug).slice(0, 3));
      })
      .catch(() => {
        /* related reads are a nicety — a failure here shouldn't break the page */
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (notFound) {
    return (
      <div className="wrap">
        <section className="sect" style={{ paddingTop: 60, maxWidth: 640 }}>
          <Eyebrow>Reports</Eyebrow>
          <h1 className="big">We can’t find that report.</h1>
          <p className="sub" style={{ marginBottom: 20 }}>
            It may have been renamed or taken down. Everything we’ve published is on the reports
            page.
          </p>
          <Link className="btn-nav" to="/reports">
            ← All reports
          </Link>
        </section>
      </div>
    );
  }

  if (!article) return <Spinner label="Loading…" />;

  const published = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="wrap">
      <section className="sect" style={{ paddingTop: 40, maxWidth: 760 }}>
        <Link
          to="/reports"
          style={{ fontSize: 12.5, fontWeight: 600, textDecoration: 'none', color: C.blueDeep }}
        >
          ← All reports
        </Link>

        <div className="eyebrow" style={{ marginTop: 18 }}>
          {article.category}
        </div>
        <h1 className="big" style={{ fontSize: 'clamp(26px,5vw,38px)' }}>
          {article.title}
        </h1>
        <div className="mono" style={{ fontSize: 11.5, color: C.textFaint, marginBottom: 10 }}>
          Encrypt Capital Research · {published} · {article.minutes} min read{' '}
          {article.assets.map((asset) => (
            <span className="doc" key={asset.id}>
              {asset.kind}
            </span>
          ))}
        </div>
        <p className="sub" style={{ fontSize: 16.5, color: '#3D5068', marginBottom: 26 }}>
          {article.dek}
        </p>

        <div className="artbody">
          {article.body.map((block, i) => {
            if (block.type === 'para') return <p key={i}>{block.text}</p>;
            if (block.type === 'list')
              return (
                <ul key={i}>
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              );
            return (
              <p key={i}>
                <b style={{ color: C.ink }}>{block.heading}</b> {block.text}
              </p>
            );
          })}
        </div>

        <div className="dlcta" style={{ margin: '26px 0 22px' }}>
          <Texture />
          <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 5 }}>Read the full study.</div>
          <div
            style={{
              fontSize: 13,
              color: C.onDarkMute,
              lineHeight: 1.55,
              marginBottom: 16,
              maxWidth: 460,
            }}
          >
            This is the short version — the complete report goes deeper into the data, the method,
            and the caveats.
          </div>
          {article.assets.length ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {article.assets.map((asset, i) => (
                <a
                  key={asset.id}
                  className={i === 0 ? 'btn-gold' : 'btn-ghost'}
                  href={api.articles.downloadUrl(article.slug, asset.id)}
                  style={{ fontSize: 13.5, padding: '11px 18px' }}
                >
                  {asset.kind === 'PDF' ? 'Download the PDF' : 'Download the deck (PPTX)'}
                  <span style={{ opacity: 0.7, fontWeight: 400 }}>
                    {' '}
                    · {fileSize(asset.sizeBytes)}
                  </span>
                </a>
              ))}
              <span style={{ fontSize: 11.5, color: C.onDarkMute }}>Free. No sign-up needed.</span>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: C.onDarkMute }}>
              The full document for this piece hasn’t been attached yet. It’ll appear here the
              moment it’s uploaded.
            </div>
          )}
        </div>

        <div className="riskfoot">
          For information only. Not investment advice or a recommendation to buy, sell, or hold any
          asset. All investing carries risk, and you can lose money. Do your own research and speak
          to a licensed adviser before making a decision.
        </div>
      </section>

      {related.length > 0 && (
        <section className="sect-tight" style={{ paddingBottom: 20 }}>
          <Eyebrow>Related reads</Eyebrow>
          <div className="grid3" style={{ marginTop: 10 }}>
            {related.map((item) => (
              <ArticleCard key={item.id} article={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
