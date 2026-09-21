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

export default crons;
