import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Initializes default connection socket.
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redis.on("connect", () => {
  console.log("Redis Connected");
});

redis.on("error", (err) => {
  console.error("Redis Error:", err);
});

export default redis;