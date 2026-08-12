import type { Model, QueryFilter } from 'mongoose';

/**
 * Keeps only the newest `limit` documents matching `filter`, deleting the rest.
 *
 * History and compare-history both cap what they retain per URL and per pair, and both
 * had the same count → find-oldest → deleteMany sequence written out with the same
 * constant. Returns how many were removed.
 *
 * Ordered by `createdAt`, so it only applies to timestamped collections — which is every
 * collection that accumulates.
 */
export async function pruneToLimit<T>(
  model: Model<T>,
  filter: QueryFilter<T>,
  limit: number,
): Promise<number> {
  const count = await model.countDocuments(filter);
  if (count <= limit) return 0;

  const oldest = await model
    .find(filter)
    .sort({ createdAt: 1 })
    .limit(count - limit)
    .select('_id')
    .lean();

  const { deletedCount } = await model.deleteMany({
    _id: { $in: oldest.map(doc => doc._id) },
  } as QueryFilter<T>);

  return deletedCount;
}
