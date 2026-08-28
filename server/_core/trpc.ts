import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { resolveApyAccess } from "../apyAccess";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

async function getApyAccessOrThrow(ctx: TrpcContext) {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return resolveApyAccess(ctx.user);
}

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const apyAccess = await getApyAccessOrThrow(ctx);
    if (!ctx.user || !apyAccess.canManageOperations) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user, apyAccess } });
  }),
);

/** Owner-only access for revenue and invoice dashboards. */
export const ownerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const apyAccess = await getApyAccessOrThrow(ctx);
    if (!ctx.user || apyAccess.level !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    return next({ ctx: { ...ctx, user: ctx.user, apyAccess } });
  }),
);

// Allows both admin and staff roles — use for procedures that staff should access
export const staffProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const apyAccess = await getApyAccessOrThrow(ctx);
    if (!ctx.user || !apyAccess.canManageOperations) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user, apyAccess } });
  }),
);

/** Any active APY team member, including Yoga Instructors and Puppy Monitors. */
export const teamMemberProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const apyAccess = await getApyAccessOrThrow(ctx);
    if (!ctx.user || apyAccess.level === "none") throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    return next({ ctx: { ...ctx, user: ctx.user, apyAccess } });
  }),
);
