import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * A closure is a claim about the world, and the world moves.
 *
 * This runs daily and re-examines every case we have called verified: if the
 * evidence that closed it has aged out, the case goes back to dispute instead of
 * keeping a stale "done" on the board. Nothing is deleted and nothing is
 * reworded - the case simply stops claiming to be settled.
 */
const crons = cronJobs();

crons.daily(
  "re-examine verified cases",
  { hourUTC: 6, minuteUTC: 15 },
  internal.recheck.verified,
  { maxAgeDays: 30 }
);

/**
 * The chase sweep.
 *
 * Hourly rather than daily: a case is chased every second day, and an hourly
 * sweep means the message goes out close to when it is due instead of whenever the
 * daily job happens to run. It is a safety net as much as a mechanism - each case
 * schedules its own chase too, and a case whose scheduled job was lost is still
 * found here.
 */
crons.hourly(
  "chase what is outstanding",
  { minuteUTC: 20 },
  internal.chase.sweep,
  { limit: 25 }
);

export default crons;
