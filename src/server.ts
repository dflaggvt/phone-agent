import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./shared/logger.js";

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const app = createApp({ env, logger });

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "phone-agent backend listening");
});

