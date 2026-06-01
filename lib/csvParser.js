const unzipper = require("unzipper");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
const axios = require("axios");
const { Queue } = require("bullmq");
const { createObjectCsvWriter } = require("csv-writer");

const BATCH_SIZE = 100;

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT || 6379);
const redisPassword = process.env.REDIS_PASSWORD || "";

const queueConnection = {
  host: redisHost,
  port: redisPort,
  ...(redisPassword ? { password: redisPassword } : {}),
};

const apiQueue = new Queue("apiQueue", { connection: queueConnection });

async function fetchAndParseCsvFromZip(url, options = {}) {
  const response = await axios.get(url, {
    responseType: "stream",
    auth: options.auth,
    timeout: options.timeout || 30000,
  });

  const csvStream = await unzipCsvStream(response.data);
  const data = await parseAndGroupCsv(csvStream);
  await writeNewCsv(options.outputPath || "./output.csv", data);
  return data;
}

function unzipCsvStream(zipStream) {
  return new Promise((resolve, reject) => {
    zipStream
      .pipe(unzipper.Parse())
      .on("entry", (entry) => {
        if (entry.path.endsWith(".csv")) {
          resolve(entry);
        } else {
          entry.autodrain();
        }
      })
      .on("error", reject);
  });
}

function parseAndGroupCsv(csvStream) {
  return new Promise((resolve, reject) => {
    const productMap = {};

    csvStream
      .pipe(csvParser({ separator: ";" }))
      .on("data", (row) => {
        const towKod = row.TOW_KOD;
        const warehouse = row.WAREHOUSE;
        const availability = row.AVAILABILITY;

        if (!productMap[towKod]) {
          productMap[towKod] = {
            TOW_KOD: towKod,
            IC_INDEX: row.IC_INDEX,
            TEC_DOC: row.TEC_DOC,
            TEC_DOC_ID: row.TEC_DOC,
            TEC_DOC_PROD: row.TEC_DOC_PROD,
            WAREHOUSE: {},
            DEFAULT_WAREHOUSE_AVAILABILITY: null,
            ALDOC_DATA_PROCESSED: false,
          };
        }

        if (warehouse === "KOM") {
          productMap[towKod].DEFAULT_WAREHOUSE_AVAILABILITY = availability;
        }

        productMap[towKod].WAREHOUSE[warehouse] = availability;
      })
      .on("end", () => resolve(Object.values(productMap)))
      .on("error", reject);
  });
}

async function writeNewCsv(outputFile, products) {
  const csvWriter = createObjectCsvWriter({
    path: outputFile,
    header: [
      { id: "TOW_KOD", title: "TOW_KOD" },
      { id: "IC_INDEX", title: "IC_INDEX" },
      { id: "TEC_DOC", title: "TEC_DOC" },
      { id: "TEC_DOC_PROD", title: "TEC_DOC_PROD" },
      { id: "WAREHOUSE", title: "WAREHOUSE" },
      {
        id: "DEFAULT_WAREHOUSE_AVAILABILITY",
        title: "DEFAULT_WAREHOUSE_AVAILABILITY",
      },
    ],
  });

  const rows = products.map((product) => ({
    ...product,
    WAREHOUSE: JSON.stringify(product.WAREHOUSE).replace(/"/g, "'"),
  }));

  await csvWriter.writeRecords(rows);
}

async function addBatchToQueue(batch) {
  await apiQueue.add("apiCall", batch, {
    attempts: 3,
    backoff: { type: "fixed", delay: 60000 },
  });
}

module.exports = {
  fetchAndParseCsvFromZip,
  writeNewCsv,
  parseAndGroupCsv,
  apiQueue,
  BATCH_SIZE,
  addBatchToQueue,
};
