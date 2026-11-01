import { Router, type Express, type Request, type Response } from "express";
import { revokeCurrentSession } from "../_core/oauth";
import { sdk } from "../_core/sdk";
import {
  acceptProbe,
  blockProbe,
  blockThread,
  getThread,
  ignoreProbe,
  listBlocks,
  listInbox,
  listThreads,
  postThreadMessage,
  removeBlock,
  reportProbe,
  reportThread,
  revealThreadIdentity,
  wipeInbox,
} from "./conversations";
import {
  createMassSubmission,
  createSubmission,
  deleteGetEvenProfile,
  getViewerWithProfile,
  listSent,
  saveProfile,
} from "./profiles";
import {
  isConfirmed,
  validateMassProbeInput,
  validateMessage,
  validatePhoneInput,
  validateProbeInput,
  validateProfileInput,
  validateReason,
  validateVerifyCodeInput,
} from "./validation";
import {
  sendVerificationCode,
  verifyCode,
} from "./phone-verification";

export type GetEvenRequest = Request & {
  getEvenActor?: { id: number; name: string | null };
};

type Handler = (req: GetEvenRequest, res: Response) => Promise<void>;

function actor(req: GetEvenRequest) {
  if (!req.getEvenActor) throw new Error("Unauthenticated");
  return req.getEvenActor;
}

function genericFailure(error: unknown, res: Response) {
  const message = error instanceof Error ? error.message : "";
  if (
    message === "Submission limit reached" ||
    message === "Profile change limit reached"
  ) {
    res.status(429).json({ error: "Try again later" });
    return;
  }
  if (message === "Profile required") {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  if (message === "Phone verification required") {
    res.status(400).json({ error: "Please verify your phone number with the SMS code" });
    return;
  }
  res.status(500).json({ error: "Request failed" });
}

function handle(fn: Handler) {
  return (req: GetEvenRequest, res: Response) => {
    void fn(req, res).catch((error: unknown) => genericFailure(error, res));
  };
}

function notFound(res: Response) {
  res.status(404).json({ error: "Not found" });
}

/** Register only authenticated private REST routes; no route emits cacheable sensitive content. */
export function registerGetEvenRoutes(app: Express): void {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    void sdk
      .authenticateRequest(req)
      .then((user) => {
        if (user.isCron || !Number.isSafeInteger(user.id) || user.id <= 0)
          throw new Error("unauthorized");
        (req as GetEvenRequest).getEvenActor = {
          id: user.id,
          name: user.name ?? null,
        };
        next();
      })
      .catch(() => res.status(401).json({ error: "Unauthorized" }));
  });

  router.get(
    "/me",
    handle(async (req, res) => {
      res.json(await getViewerWithProfile(actor(req)));
    }),
  );
  router.post(
    "/phone-verification/send",
    handle(async (req, res) => {
      const input = validatePhoneInput(req.body);
      if (!input) {
        res.status(400).json({ error: "Invalid phone number format. Please include country code." });
        return;
      }
      try {
        const result = await sendVerificationCode(input.phone);
        res.json(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send verification code";
        res.status(400).json({ error: message });
      }
    }),
  );
  router.post(
    "/phone-verification/verify",
    handle(async (req, res) => {
      const input = validateVerifyCodeInput(req.body);
      if (!input) {
        res
          .status(400)
          .json({ error: "Please enter your number and the 6-digit code" });
        return;
      }
      const result = await verifyCode(input.phone, input.code);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json(result);
    }),
  );
  router.put(
    "/profile",
    handle(async (req, res) => {
      const input = validateProfileInput(req.body);
      if (!input) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }
      res.json({ profile: await saveProfile(actor(req), input) });
    }),
  );
  router.delete(
    "/profile",
    handle(async (req, res) => {
      await deleteGetEvenProfile(actor(req));
      res.json({ ok: true });
    }),
  );

  router.get(
    "/sent",
    handle(async (req, res) => {
      res.json({ items: await listSent(actor(req)) });
    }),
  );
  router.post(
    "/probes",
    handle(async (req, res) => {
      const input = validateProbeInput(req.body);
      if (!input) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }
      // This path only persists an opaque receipt. The finite worker resolves routing later.
      res.json(await createSubmission(actor(req), input));
    }),
  );
  router.post(
    "/probes/mass",
    handle(async (req, res) => {
      const input = validateMassProbeInput(req.body);
      if (!input) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }
      // Like single probes, this acknowledgement stores only opaque receipts.
      res.json(await createMassSubmission(actor(req), input));
    }),
  );

  router.get(
    "/inbox",
    handle(async (req, res) => {
      res.json({ items: await listInbox(actor(req)) });
    }),
  );
  router.delete(
    "/inbox",
    handle(async (req, res) => {
      await wipeInbox(actor(req));
      res.json({ ok: true });
    }),
  );
  router.post(
    "/inbox/:id/ignore",
    handle(async (req, res) => {
      if (!(await ignoreProbe(actor(req), req.params.id))) return notFound(res);
      res.json({ ok: true });
    }),
  );
  router.post(
    "/inbox/:id/accept",
    handle(async (req, res) => {
      const input = validateMessage({
        text: req.body?.message,
        clientId: `accept:${req.params.id}`,
      });
      if (!input) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }
      const threadId = await acceptProbe(actor(req), req.params.id, input.text);
      if (!threadId) return notFound(res);
      res.json({ threadId });
    }),
  );
  router.post(
    "/inbox/:id/block",
    handle(async (req, res) => {
      if (!(await blockProbe(actor(req), req.params.id))) return notFound(res);
      res.json({ ok: true });
    }),
  );
  router.post(
    "/inbox/:id/report",
    handle(async (req, res) => {
      const input = validateReason(req.body);
      if (!input) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }
      if (
        !(await reportProbe(
          actor(req),
          req.params.id,
          input.reason,
          input.includeContent,
        ))
      )
        return notFound(res);
      res.json({ ok: true });
    }),
  );

  router.get(
    "/threads",
    handle(async (req, res) => {
      res.json({ items: await listThreads(actor(req)) });
    }),
  );
  router.get(
    "/threads/:id",
    handle(async (req, res) => {
      const result = await getThread(actor(req), req.params.id);
      if (!result) return notFound(res);
      res.json(result);
    }),
  );
  router.post(
    "/threads/:id/messages",
    handle(async (req, res) => {
      const input = validateMessage(req.body);
      if (!input) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }
      if (
        !(await postThreadMessage(
          actor(req),
          req.params.id,
          input.text,
          input.clientId,
        ))
      )
        return notFound(res);
      res.json({ ok: true });
    }),
  );
  router.post(
    "/threads/:id/reveal",
    handle(async (req, res) => {
      if (!isConfirmed(req.body)) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }
      if (!(await revealThreadIdentity(actor(req), req.params.id)))
        return notFound(res);
      res.json({ ok: true });
    }),
  );
  router.post(
    "/threads/:id/block",
    handle(async (req, res) => {
      if (!(await blockThread(actor(req), req.params.id))) return notFound(res);
      res.json({ ok: true });
    }),
  );
  router.post(
    "/threads/:id/report",
    handle(async (req, res) => {
      const input = validateReason(req.body);
      if (!input) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }
      if (
        !(await reportThread(
          actor(req),
          req.params.id,
          input.reason,
          input.includeContent,
        ))
      )
        return notFound(res);
      res.json({ ok: true });
    }),
  );

  router.get(
    "/blocks",
    handle(async (req, res) => {
      res.json({ items: await listBlocks(actor(req)) });
    }),
  );
  router.delete(
    "/blocks/:id",
    handle(async (req, res) => {
      if (!(await removeBlock(actor(req), req.params.id))) return notFound(res);
      res.json({ ok: true });
    }),
  );

  router.post(
    "/logout",
    handle(async (req, res) => {
      await revokeCurrentSession(req, res);
      res.json({ ok: true });
    }),
  );

  app.use("/api/get-even", router);
}
