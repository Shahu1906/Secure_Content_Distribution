import { createClient } from "redis";

if (!process.env.REDIS_URL) {
  console.warn("WARNING: REDIS_URL is not defined in environment variables. Defaulting to localhost.");
}

const needsTls = process.env.REDIS_URL?.startsWith('rediss://');

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: needsTls ? {
    tls: true,
    rejectUnauthorized: false
  } : undefined
});

redis.on("error", (err) => {
  console.error("Redis Error:", err);
});

await redis.connect();

export default redis;
