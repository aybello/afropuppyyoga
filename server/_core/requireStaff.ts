/**
 * Express middleware that requires the caller to be authenticated as admin or staff.
 * Uses the same session cookie mechanism as tRPC's staffProcedure.
 * Returns 401 if not authenticated, 403 if authenticated but wrong role.
 */
import type { Request, Response, NextFunction } from "express";
import { sdk } from "./sdk";

export async function requireStaffOrAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await sdk.authenticateRequest(req as any);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({ error: "Staff or admin access required" });
    }
    // Attach user to request for downstream handlers
    (req as any).staffUser = user;
    next();
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }
}
