const zlib = require("zlib");

/**
 * AutoPartner returns FileContent as gzip-compressed bytes (JSON number[])
 * or occasionally as a base64 string. Decompress to UTF-8 text (XML or CSV).
 */
function decodeApFileContent(fileContent) {
  if (fileContent == null) {
    return null;
  }

  let buffer;
  if (Array.isArray(fileContent)) {
    buffer = Buffer.from(fileContent);
  } else if (typeof fileContent === "string") {
    const trimmed = fileContent.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith("<") || trimmed.startsWith("{")) {
      return trimmed;
    }
    try {
      buffer = Buffer.from(trimmed, "base64");
    } catch {
      buffer = Buffer.from(trimmed, "utf8");
    }
  } else {
    return null;
  }

  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return zlib.gunzipSync(buffer).toString("utf8");
  }

  const asText = buffer.toString("utf8");
  if (asText.startsWith("<") || asText.includes(";")) {
    return asText;
  }

  return asText;
}

function normalizeApFileResponseBody(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  const out = { ...data };
  for (const key of Object.keys(out)) {
    const block = out[key];
    if (!block || typeof block !== "object" || !("FileContent" in block)) {
      continue;
    }
    const decoded = decodeApFileContent(block.FileContent);
    if (decoded != null) {
      out[key] = { ...block, FileContent: decoded };
    }
  }
  return out;
}

module.exports = {
  decodeApFileContent,
  normalizeApFileResponseBody,
};
