import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * The bytes of an uploaded research attachment.
 *
 * Kept in its own collection rather than inside the Article document: article
 * listings are read constantly and would otherwise drag every PDF along with
 * them. The Article holds only a reference.
 *
 * Storing files in the database rather than on local disk is deliberate. Render,
 * Railway, Fly and Heroku all use an ephemeral filesystem — anything written
 * there is destroyed on the next deploy or restart, so a PDF uploaded on Monday
 * would 404 by Wednesday. The database is the only durable store this app has.
 */

/**
 * A MongoDB document cannot exceed 16MB, so uploads stop at 15MB — leaving room
 * for the surrounding fields rather than failing at save time.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '15 MB';

export interface ArticleFileDoc extends Document {
  _id: mongoose.Types.ObjectId;
  data: Buffer;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
}

const articleFileSchema = new Schema<ArticleFileDoc>(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ArticleFile: Model<ArticleFileDoc> =
  (mongoose.models.ArticleFile as Model<ArticleFileDoc>) ??
  mongoose.model<ArticleFileDoc>('ArticleFile', articleFileSchema);
