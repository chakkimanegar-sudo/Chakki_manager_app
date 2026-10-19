import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Do not report the sync API as healthy just because Express is running.
 * Verify the database connection and the two tables required by sync as well.
 */
async function healthHandler(_req: Request, res: Response): Promise<void> {
  try {
    await pool.query("SELECT 1 FROM public.shops LIMIT 0");
    await pool.query("SELECT 1 FROM public.shop_data LIMIT 0");

    res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch (error) {
    // Keep internal database details in service logs, not in the public response.
    console.error(
      "[health] Sync database check failed:",
      error instanceof Error ? error.message : "unknown database error",
    );
    res.status(503).json({
      status: "error",
      error: "Sync database ready nahi hai. DATABASE_URL aur shops/shop_data tables check karein.",
    });
  }
}

router.get("/healthz", healthHandler);
router.get("/health", healthHandler);

export default router;
