import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Sync snapshots grow with the shop's history. The default Express JSON
// limit (100kb) caused otherwise valid device sync PUTs to fail with 413.
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Sync data is live shared state. Prevent browser/proxy validation caching
// from turning a normal GET into a 304 response with no JSON body.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use("/api", router);

export default app;
