import { Router } from "express";
import { eventsRouter } from "./events";
import { emailCaptureRouter } from "./emailCapture";
import { authRouter } from "./auth";
import { adminRouter } from "./admin";
import { healthRouter } from "./health";

const router = Router();

// Mount route modules
router.use("/events", eventsRouter);
router.use("/email-capture", emailCaptureRouter);
router.use("/admin", adminRouter);
router.use("/health", healthRouter);

export { router as apiRouter };
export { authRouter };
