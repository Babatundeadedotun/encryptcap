import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ARTICLE_CATEGORIES, Article, type ArticleDoc, slugify } from '../models/Article.js';
import { ArticleFile, MAX_UPLOAD_BYTES } from '../models/ArticleFile.js';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/error.js';

export const articlesRouter = Router();

const ALLOWED = new Map<string, 'PDF' | 'PPTX'>([
  ['application/pdf', 'PDF'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'PPTX'],
  ['application/vnd.ms-powerpoint', 'PPTX'],
]);

/**
 * Uploads are held in memory and then written to the database, so they survive
 * the deploys and restarts that wipe a container's local disk.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new HttpError(415, 'Only PDF and PPTX files can be attached to a report.'));
      return;
    }
    cb(null, true);
  },
});

const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('para'), text: z.string().min(1) }),
  z.object({ type: z.literal('lead'), heading: z.string().min(1), text: z.string() }),
  z.object({ type: z.literal('list'), items: z.array(z.string().min(1)).min(1) }),
]);

const articleSchema = z.object({
  title: z.string().trim().min(4, 'Give the piece a title.').max(220),
  category: z.enum(ARTICLE_CATEGORIES),
  dek: z.string().trim().min(10, 'Add a one-line standfirst.').max(400),
  minutes: z.number().int().min(1).max(90),
  body: z.array(blockSchema).min(1, 'The article needs at least one paragraph.'),
  published: z.boolean().optional(),
  slug: z.string().trim().max(80).optional(),
});

/** Public listing shape — never leaks the on-disk filename. */
function toPublic(article: ArticleDoc) {
  return {
    id: article._id.toString(),
    slug: article.slug,
    category: article.category,
    title: article.title,
    dek: article.dek,
    minutes: article.minutes,
    body: article.body,
    published: article.published,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    updatedAt: article.updatedAt.toISOString(),
    assets: article.assets.map((asset) => ({
      id: asset._id.toString(),
      kind: asset.kind,
      originalName: asset.originalName,
      sizeBytes: asset.sizeBytes,
      downloads: asset.downloads,
    })),
  };
}

/* --------------------------------------------------------------- public */

articlesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const filter: Record<string, unknown> = { published: true };
    if (category && category !== 'All') filter.category = category;

    const articles = await Article.find(filter).sort({ publishedAt: -1 });
    res.json({ articles: articles.map(toPublic) });
  }),
);

/* -------------------------------------------------------------- manager */
/* Declared before /:slug so "admin" is not swallowed as a slug. */

articlesRouter.get(
  '/admin/all',
  requireAuth,
  requireManager,
  asyncHandler(async (_req, res) => {
    const articles = await Article.find({}).sort({ updatedAt: -1 });
    res.json({ articles: articles.map(toPublic) });
  }),
);

articlesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const article = await Article.findOne({ slug: req.params.slug, published: true });
    if (!article) throw new HttpError(404, 'That report does not exist.');
    res.json({ article: toPublic(article) });
  }),
);

articlesRouter.get(
  '/:slug/download/:assetId',
  asyncHandler(async (req, res) => {
    const article = await Article.findOne({ slug: req.params.slug, published: true });
    if (!article) throw new HttpError(404, 'That report does not exist.');

    const asset = article.assets.id(req.params.assetId);
    if (!asset) throw new HttpError(404, 'That download does not exist.');

    const stored = await ArticleFile.findById(asset.file);
    if (!stored) throw new HttpError(410, 'That file is no longer available.');

    asset.downloads += 1;
    await article.save();

    // The filename is quoted and stripped of quotes and control characters so a
    // crafted upload name cannot inject extra header directives.
    const safeName = asset.originalName.replace(/[\r\n"\\]/g, '_');
    res.setHeader('Content-Type', stored.contentType);
    res.setHeader('Content-Length', stored.sizeBytes);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(stored.data);
  }),
);

articlesRouter.post(
  '/',
  requireAuth,
  requireManager,
  asyncHandler(async (req, res) => {
    const input = articleSchema.parse(req.body);
    const slug = slugify(input.slug || input.title);

    if (await Article.findOne({ slug }).lean()) {
      throw new HttpError(409, 'A report with that web address already exists.');
    }

    const article = await Article.create({
      ...input,
      slug,
      published: input.published ?? false,
      createdBy: req.user!.id,
    });

    res.status(201).json({ article: toPublic(article) });
  }),
);

articlesRouter.patch(
  '/:id',
  requireAuth,
  requireManager,
  asyncHandler(async (req, res) => {
    const input = articleSchema.partial().parse(req.body);
    const article = await Article.findById(req.params.id);
    if (!article) throw new HttpError(404, 'That report does not exist.');

    if (input.slug) input.slug = slugify(input.slug);
    Object.assign(article, input);
    await article.save();

    res.json({ article: toPublic(article) });
  }),
);

articlesRouter.post(
  '/:id/assets',
  requireAuth,
  requireManager,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const article = await Article.findById(req.params.id);
    if (!article) throw new HttpError(404, 'That report does not exist.');
    if (!req.file) throw new HttpError(400, 'Choose a file to attach.');

    const stored = await ArticleFile.create({
      data: req.file.buffer,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size,
    });

    article.assets.push({
      kind: ALLOWED.get(req.file.mimetype)!,
      file: stored._id,
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      downloads: 0,
      uploadedAt: new Date(),
    } as never);
    await article.save();

    res.status(201).json({ article: toPublic(article) });
  }),
);

articlesRouter.delete(
  '/:id/assets/:assetId',
  requireAuth,
  requireManager,
  asyncHandler(async (req, res) => {
    const article = await Article.findById(req.params.id);
    if (!article) throw new HttpError(404, 'That report does not exist.');

    const asset = article.assets.id(req.params.assetId);
    if (!asset) throw new HttpError(404, 'That download does not exist.');

    const fileId = asset.file;
    asset.deleteOne();
    await article.save();
    // Best effort — an already-missing file shouldn't fail the request.
    await ArticleFile.deleteOne({ _id: fileId });

    res.json({ article: toPublic(article) });
  }),
);

articlesRouter.delete(
  '/:id',
  requireAuth,
  requireManager,
  asyncHandler(async (req, res) => {
    const article = await Article.findById(req.params.id);
    if (!article) throw new HttpError(404, 'That report does not exist.');

    await ArticleFile.deleteMany({ _id: { $in: article.assets.map((asset) => asset.file) } });
    await article.deleteOne();

    res.json({ ok: true });
  }),
);
