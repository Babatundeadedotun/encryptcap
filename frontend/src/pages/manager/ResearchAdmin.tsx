import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Article, ArticleBlock } from '../../api/types';
import { ARTICLE_CATEGORIES, C } from '../../lib/constants';
import { fileSize } from '../../lib/format';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorNote, Eyebrow, Field, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';

/* ------------------------------------------------------------------ list */

export function ResearchList() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const { articles: list } = await api.articles.all();
      setArticles(list);
    } catch {
      setArticles([]);
    }
    try {
      const { count } = await api.subscribers.list();
      setSubscriberCount(count);
    } catch {
      setSubscriberCount(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (article: Article) => {
    if (!window.confirm(`Delete “${article.title}”? This also removes its uploaded files.`)) return;
    try {
      await api.articles.remove(article.id);
      toast('Report deleted.');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete that report.');
    }
  };

  return (
    <div className="wrap" style={{ paddingTop: 22 }}>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Eyebrow>Research</Eyebrow>
          <h2 className="head">What we’ve published.</h2>
          <p className="sub">
            Short articles with the full study attached as a PDF or deck. Drafts stay invisible on
            the public site until you publish them.
            {subscriberCount !== null && (
              <>
                {' '}
                <b style={{ color: C.ink }}>
                  {subscriberCount} {subscriberCount === 1 ? 'person is' : 'people are'}
                </b>{' '}
                on the notify list.
              </>
            )}
          </p>
        </div>
        <Link className="btn-nav" to="/app/manager/reports/new">
          + New report
        </Link>
      </div>

      {articles === null ? (
        <Spinner label="Loading research…" />
      ) : articles.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="Nothing published yet."
            body="Write your first piece and attach the study investors can download."
          />
        </div>
      ) : (
        <div className="panel">
          <div className="tbl-scroll">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th className="num">Files</th>
                  <th className="num">Downloads</th>
                  <th className="num">Status</th>
                  <th className="num" />
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id} style={{ cursor: 'default' }}>
                    <td>
                      <Link
                        to={`/app/manager/reports/${article.id}`}
                        style={{ fontWeight: 600, color: C.ink, textDecoration: 'none' }}
                      >
                        {article.title}
                      </Link>
                    </td>
                    <td style={{ color: C.textMute }}>{article.category}</td>
                    <td className="num">{article.assets.length}</td>
                    <td className="num">
                      {article.assets.reduce((sum, a) => sum + a.downloads, 0)}
                    </td>
                    <td className="num">
                      <span
                        className="status"
                        style={{
                          color: article.published ? C.green : C.textFaint,
                          background: `${article.published ? C.green : C.textFaint}14`,
                          border: `1px solid ${article.published ? C.green : C.textFaint}44`,
                        }}
                      >
                        {article.published ? 'live' : 'draft'}
                      </span>
                    </td>
                    <td className="num">
                      <button
                        className="authlink"
                        style={{ color: C.red }}
                        onClick={() => onDelete(article)}
                        aria-label={`Delete ${article.title}`}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- editor */

/** Plain-text body format: blank-line separated. "Heading. Text" becomes a lead
 *  block; a line starting with "- " begins a bullet list. */
function parseBody(raw: string): ArticleBlock[] {
  return raw
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map<ArticleBlock>((chunk) => {
      const lines = chunk.split('\n').map((l) => l.trim());

      if (lines.every((l) => l.startsWith('- '))) {
        return { type: 'list', items: lines.map((l) => l.slice(2).trim()) };
      }

      const lead = /^(.{3,80}?[.:])\s+(.*)$/s.exec(chunk);
      if (lead && !chunk.startsWith('- ')) {
        return { type: 'lead', heading: lead[1].trim(), text: lead[2].trim() };
      }

      return { type: 'para', text: chunk };
    });
}

function serialiseBody(blocks: ArticleBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === 'para') return block.text;
      if (block.type === 'list') return block.items.map((i) => `- ${i}`).join('\n');
      return `${block.heading} ${block.text}`.trim();
    })
    .join('\n\n');
}

export function ResearchEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Markets');
  const [dek, setDek] = useState('');
  const [minutes, setMinutes] = useState(3);
  const [body, setBody] = useState('');
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;

    api.articles
      .all()
      .then(({ articles }) => {
        const found = articles.find((a) => a.id === id);
        if (cancelled) return;
        if (!found) {
          setError('That report no longer exists.');
          setLoading(false);
          return;
        }
        setArticle(found);
        setTitle(found.title);
        setCategory(found.category);
        setDek(found.dek);
        setMinutes(found.minutes);
        setBody(serialiseBody(found.body));
        setPublished(found.published);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load that report.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const complete = Boolean(title.trim() && dek.trim() && body.trim());

  const onSave = async () => {
    if (!complete || busy) return;
    setError(null);
    setBusy(true);

    const payload = {
      title: title.trim(),
      category,
      dek: dek.trim(),
      minutes,
      body: parseBody(body),
      published,
    };

    try {
      if (isNew) {
        const { article: created } = await api.articles.create(payload);
        toast('Report created.');
        setArticle(created);
        navigate(`/app/manager/reports/${created.id}`, { replace: true });
      } else {
        const { article: updated } = await api.articles.update(id!, payload);
        setArticle(updated);
        toast('Saved.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that report.');
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (file: File) => {
    if (!article) return;
    setBusy(true);
    try {
      const { article: updated } = await api.articles.upload(article.id, file);
      setArticle(updated);
      toast('File attached.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not attach that file.');
    } finally {
      setBusy(false);
    }
  };

  const onRemoveAsset = async (assetId: string) => {
    if (!article) return;
    try {
      const { article: updated } = await api.articles.removeAsset(article.id, assetId);
      setArticle(updated);
      toast('File removed.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not remove that file.');
    }
  };

  if (loading) return <Spinner label="Loading…" />;

  return (
    <div className="wrap" style={{ paddingTop: 22, maxWidth: 760 }}>
      <Link
        to="/app/manager/reports"
        style={{ fontSize: 12.5, fontWeight: 600, textDecoration: 'none', color: C.blueDeep }}
      >
        ← All research
      </Link>

      <div style={{ margin: '18px 0 14px' }}>
        <Eyebrow>{isNew ? 'New report' : 'Edit report'}</Eyebrow>
        <h2 className="head">{isNew ? 'Write a new piece.' : title || 'Untitled'}</h2>
      </div>

      <div className="panel">
        {error && <ErrorNote>{error}</ErrorNote>}

        <Field id="ra-title" label="Title" required>
          <input id="ra-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <div className="grid2">
          <Field id="ra-cat" label="Category" required>
            <select id="ra-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {ARTICLE_CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field id="ra-mins" label="Read time (minutes)" required>
            <input
              id="ra-mins"
              type="number"
              min={1}
              max={90}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </Field>
        </div>

        <Field
          id="ra-dek"
          label="Standfirst"
          required
          hint="The one-line summary shown on the card and under the headline."
        >
          <input id="ra-dek" type="text" value={dek} onChange={(e) => setDek(e.target.value)} />
        </Field>

        <Field
          id="ra-body"
          label="Body"
          required
          hint="Separate paragraphs with a blank line. Start a paragraph with a short sentence ending in a full stop to make it a bold lead-in. Prefix lines with “- ” for a bullet list."
        >
          <textarea
            id="ra-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            style={{ lineHeight: 1.6, resize: 'vertical' }}
          />
        </Field>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            fontSize: 13.5,
            color: C.ink,
            marginBottom: 14,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Published — visible on the public reports page
        </label>

        <button className="btn-block" onClick={onSave} disabled={!complete || busy}>
          {busy ? 'Saving…' : isNew ? 'Create report' : 'Save changes'}
        </button>
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>Attached documents</h3>
          <span className="tag">PDF or PPTX · max 15 MB</span>
        </div>

        {isNew || !article ? (
          <EmptyState
            title="Save the report first."
            body="Once it exists you can attach the PDF or deck readers download."
          />
        ) : (
          <>
            {article.assets.map((asset) => (
              <div className="stmt" key={asset.id}>
                <span style={{ color: C.ink, fontWeight: 600 }}>
                  <span className="doc">{asset.kind}</span> {asset.originalName}
                </span>
                <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span className="mono" style={{ color: C.textFaint, fontSize: 11.5 }}>
                    {fileSize(asset.sizeBytes)} · {asset.downloads} downloads
                  </span>
                  <button
                    className="authlink"
                    style={{ color: C.red }}
                    onClick={() => onRemoveAsset(asset.id)}
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}

            <label
              className="btn-nav ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 14,
                cursor: 'pointer',
              }}
            >
              <Icon name="upload" size={14} />
              {busy ? 'Uploading…' : 'Attach a file'}
              <input
                type="file"
                accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUpload(file);
                  e.target.value = '';
                }}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
