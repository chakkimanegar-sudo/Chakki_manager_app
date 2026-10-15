import { Router } from "express";
import healthRouter from "./health";
import syncRouter from "./sync";

const router = Router();

router.use(healthRouter);
router.use(syncRouter);

export default router;
