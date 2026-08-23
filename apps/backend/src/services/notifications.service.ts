/**
 * The bell.
 *
 * Alerts already exist and are already logged — `AlertLog` records every one and why it
 * went where it went. What was missing is anywhere in the product to see them: they left
 * for a webhook or an inbox, and the person who opened the dashboard afterwards had no way
 * to know one had been raised. This reads the same log back, newest first.
 *
 * "Unread" is a single timestamp on the account (`User.alertsSeenAt`), not a flag per
 * alert: it cannot drift out of step with the log, it needs no write when an alert is
 * raised, and it survives an alert being pruned. The cost is that unread is per account
 * rather than per device, which is the correct trade for a tool people open on one screen.
 */
import { Types } from 'mongoose';
import { AlertLog } from '../models/AlertLog.model.js';
import { Website } from '../models/Website.model.js';
import { User } from '../models/User.model.js';
import type { NotificationEntry, NotificationsResponse } from '@perfscope/shared';

/** A bell is a list of what just happened, not an archive — the archive is the dashboard. */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function emptyNotifications(): NotificationsResponse {
  return { entries: [], unread: 0, seenAt: null };
}

export async function getNotifications(userId: string, limit = DEFAULT_LIMIT): Promise<NotificationsResponse> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
  const owner = new Types.ObjectId(userId);

  const [user, rows] = await Promise.all([
    User.findById(userId).select('alertsSeenAt').lean(),
    AlertLog.find({ userId: owner })
      .sort({ createdAt: -1 })
      .limit(capped)
      .select('websiteId url event status metrics lines aiNote createdAt')
      .lean(),
  ]);

  const seenAt = user?.alertsSeenAt ? new Date(user.alertsSeenAt) : null;

  // Counted over the whole log rather than over the page above: a account with thirty new
  // alerts and a limit of twenty would otherwise show "20" and stay at "20" after reading.
  const unread = await AlertLog.countDocuments({
    userId: owner,
    ...(seenAt ? { createdAt: { $gt: seenAt } } : {}),
  });

  // One lookup for the site names, not one per row.
  const siteIds = [...new Set(rows.map(r => String(r.websiteId)))];
  const sites = siteIds.length
    ? await Website.find({ _id: { $in: siteIds } }).select('url').lean()
    : [];
  const siteUrlById = new Map(sites.map(s => [String(s._id), s.url]));

  const entries: NotificationEntry[] = rows.map((row) => {
    const at = new Date(row.createdAt as unknown as string);
    return {
      id:        String(row._id),
      event:     row.event,
      status:    row.status,
      url:       row.url,
      siteUrl:   siteUrlById.get(String(row.websiteId)) ?? row.url,
      websiteId: String(row.websiteId),
      metrics:   row.metrics ?? [],
      lines:     row.lines ?? [],
      ...(row.aiNote ? { aiNote: row.aiNote } : {}),
      at:        at.toISOString(),
      unread:    seenAt === null || at > seenAt,
    };
  });

  return { entries, unread, seenAt: seenAt ? seenAt.toISOString() : null };
}

/**
 * Mark everything up to now as seen.
 *
 * Stamped with the server's clock rather than the client's: a device with a fast clock
 * would otherwise mark alerts read before they were raised, and they would never show.
 */
export async function markNotificationsSeen(userId: string): Promise<{ seenAt: string }> {
  const seenAt = new Date();
  await User.updateOne({ _id: userId }, { $set: { alertsSeenAt: seenAt } });
  return { seenAt: seenAt.toISOString() };
}
