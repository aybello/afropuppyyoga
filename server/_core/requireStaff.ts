/**
 * Express middleware that requires the caller to be authenticated as admin or staff.
 * Uses the same session cookie mechanism as tRPC's staffProcedure.
 * Returns 401 if not authenticated, 403 if authenticated but wrong role.
 */
import type { Request, Response, NextFunction } from "express";
import { sdk } from "./sdk";
import { resolveApyAccess } from "../apyAccess";

export async function requireStaffOrAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await sdk.authenticateRequest(req as any);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const access = await resolveApyAccess(user);
    if (!access.canManageOperations) {
      return res.status(403).json({ error: "Operations Manager or owner access required" });
    }
    // Attach user to request for downstream handlers
    (req as any).staffUser = user;
    (req as any).apyAccess = access;
    next();
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }
}

/** Any active APY HQ team member; intended for self-service uploads only. */
export async function requireTeamMember(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await sdk.authenticateRequest(req as any);
    const access = await resolveApyAccess(user);
    if (access.level === "none") return res.status(403).json({ error: "Active APY team access required" });
    (req as any).staffUser = user;
    (req as any).apyAccess = access;
    next();
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }
}
