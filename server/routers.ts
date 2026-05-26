import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { APY_SYSTEM_PROMPT } from "./chatbot-knowledge";
import { invoicesRouter } from "./routers/invoices";
import { careersRouter } from "./routers/careers";
import { birthdayRouter } from "./routers/birthday";
import { partnershipRouter } from "./routers/partnership";
import { staffRouter } from "./routers/staff";
import { signingRouter } from "./routers/signing";
import { privateEventsRouter } from "./routers/privateEvents";
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(1000, "Message too long (max 1000 characters)"),
});

export const appRouter = router({
  system: systemRouter,
  invoices: invoicesRouter,
  careers: careersRouter,
  birthday: birthdayRouter,
  partnership: partnershipRouter,
  staff: staffRouter,
  signing: signingRouter,
  privateEvents: privateEventsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  chatbot: router({
    chat: publicProcedure
      .input(
        z.object({
          messages: z.array(messageSchema).max(20),
        })
      )
      .mutation(async ({ input }) => {
        const llmMessages = [
          { role: "system" as const, content: APY_SYSTEM_PROMPT },
          ...input.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        const response = await invokeLLM({ messages: llmMessages });
        const reply =
          response.choices?.[0]?.message?.content ??
          "I'm not sure about that one! Reach out to us at afropuppyyogaofficial@gmail.com and we'll help you out.";

        return { reply };
      }),
  }),
});

export type AppRouter = typeof appRouter;
