const { createClient } = require("redis");
const axios = require("axios");

const RedisKeys = {
  INTER_CARS: "ic_session_id",
  INTER_PARTS: "ip_session_id",
};

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = process.env.REDIS_PORT || "6379";
const redisPassword = process.env.REDIS_PASSWORD || "";

const redisUrl =
  process.env.REDIS_URL ||
  (redisPassword
    ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
    : `redis://${redisHost}:${redisPort}`);

const redisClient = createClient({ url: redisUrl });

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});

let connectPromise = null;

function ensureRedisConnected() {
  if (redisClient.isOpen) {
    return Promise.resolve();
  }
  if (!connectPromise) {
    connectPromise = redisClient.connect().catch((err) => {
      connectPromise = null;
      console.error("Error connecting to Redis", err);
      throw err;
    });
  }
  return connectPromise;
}

async function getSessionId(key) {
  await ensureRedisConnected();

  const sessionId = await redisClient.get(key);
  if (sessionId) {
    return sessionId;
  }

  const newSessionId = await requestNewSessionId(key);
  await redisClient.set(key, newSessionId, { EX: 3600 });
  return newSessionId;
}

async function requestNewSessionId(key) {
  if (key === RedisKeys.INTER_CARS) {
    const useSandbox = process.env.IC_USE_SANDBOX === "1";
    const clientId = useSandbox
      ? process.env.IC_SANDBOX_CLIENT_ID || ""
      : process.env.IC_PROD_CLIENT_ID || "";
    const clientSecret = useSandbox
      ? process.env.IC_SANDBOX_SECRET || ""
      : process.env.IC_PROD_SECRET || "";

    const tokenUrl =
      process.env.IC_TOKEN_URL ||
      "https://is.webapi.intercars.eu/oauth2/token?grant_type=client_credentials&scope=allinone";

    const response = await axios.post(tokenUrl, null, {
      auth: {
        username: clientId,
        password: clientSecret,
      },
    });

    return response.data.access_token;
  }

  return "";
}

module.exports = {
  redisClient,
  RedisKeys,
  getSessionId,
  ensureRedisConnected,
};
