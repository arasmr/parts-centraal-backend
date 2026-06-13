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
  await cacheSessionId(key, newSessionId);
  return newSessionId;
}

function sessionTtlSeconds(key) {
  if (key === RedisKeys.INTER_PARTS) {
    const raw = Number(process.env.INTERPARTS_SESSION_TTL_SECONDS);
    return Number.isFinite(raw) && raw > 0 ? raw : 3600;
  }
  return 3600;
}

async function cacheSessionId(key, sessionId) {
  await ensureRedisConnected();
  await redisClient.set(key, sessionId, { EX: sessionTtlSeconds(key) });
}

async function invalidateSessionId(key) {
  await ensureRedisConnected();
  await redisClient.del(key);
}

async function refreshSessionId(key) {
  await invalidateSessionId(key);
  return getSessionId(key);
}

async function requestNewSessionId(key) {
  if (key === RedisKeys.INTER_PARTS) {
    const crypto = require("crypto");
    const userLogin = process.env.INTERPARTS_USER_LOGIN || "";
    const passwordMd5 = process.env.INTERPARTS_USER_PASSWORD_MD5 || "";
    const passwordPlain = process.env.INTERPARTS_USER_PASSWORD || "";
    const userPassword =
      passwordMd5 ||
      (passwordPlain
        ? crypto.createHash("md5").update(passwordPlain, "utf8").digest("hex")
        : "");

    if (!userLogin || !userPassword) {
      throw new Error(
        "Missing INTERPARTS_USER_LOGIN and INTERPARTS_USER_PASSWORD_MD5 (or INTERPARTS_USER_PASSWORD)",
      );
    }

    const baseUrl = (
      process.env.INTERPARTS_BASE_URL ||
      "http://webservice.interparts.pl:7891/ws/"
    ).replace(/\/?$/, "/");

    const response = await axios.post(
      baseUrl,
      { doLogin: { userLogin, userPassword } },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        validateStatus: () => true,
      },
    );

    const sessionId = response.data?.doLoginResponse?.sessionId;
    if (!sessionId) {
      const errMsg =
        response.data?.error?.msg ||
        response.data?.error?.code ||
        `InterParts login failed (HTTP ${response.status})`;
      throw new Error(errMsg);
    }

    return sessionId;
  }

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
  cacheSessionId,
  invalidateSessionId,
  refreshSessionId,
  ensureRedisConnected,
};
