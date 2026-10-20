import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const ARTICLE_CATEGORIES = [
  'Markets',
  'Crypto',
  'Strategy',
  'Nigeria & the naira',
  'Fundamentals',
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

/** Body blocks, mirroring the three shapes the design uses. */
export type ArticleBlock =
  | { type: 'para'; text: string }
  | { type: 'lead'; heading: string; text: string }
  | { type: 'list'; items: string[] };

export interface ArticleAsset {
  _id: mongoose.Types.ObjectId;
  kind: 'PDF' | 'PPTX';
  /** The ArticleFile holding the bytes. */
  file: mongoose.Types.ObjectId;
  /** Display name only — never used to build a path. */
  originalName: string;
  sizeBytes: number;
  downloads: number;
  uploadedAt: Date;
}

export interface ArticleDoc extends Document {
  _id: mongoose.Types.ObjectId;
  slug: string;
  category: ArticleCategory;
  title: string;
  dek: string;
  minutes: number;
  body: ArticleBlock[];
  assets: mongoose.Types.DocumentArray<ArticleAsset>;
  published: boolean;
  publishedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<ArticleAsset>(
  {
    kind: { type: String, enum: ['PDF', 'PPTX'], required: true },
    file: { type: Schema.Types.ObjectId, ref: 'ArticleFile', required: true },
    originalName: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    downloads: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const articleSchema = new Schema<ArticleDoc>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    category: { type: String, enum: ARTICLE_CATEGORIES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    dek: { type: String, required: true, trim: true, maxlength: 400 },
    minutes: { type: Number, required: true, min: 1, max: 90 },
    // Blocks are a discriminated union, so they're stored as Mixed and
    // validated by zod at the route boundary instead of by the schema.
    body: { type: [Schema.Types.Mixed], default: [] } as never,
    assets: { type: [assetSchema], default: [] },
    published: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

articleSchema.pre('save', function stampPublishedAt(this: ArticleDoc, next) {
  if (this.published && !this.publishedAt) this.publishedAt = new Date();
  if (!this.published) this.publishedAt = undefined;
  next();
});

export const Article: Model<ArticleDoc> =
  (mongoose.models.Article as Model<ArticleDoc>) ??
  mongoose.model<ArticleDoc>('Article', articleSchema);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
