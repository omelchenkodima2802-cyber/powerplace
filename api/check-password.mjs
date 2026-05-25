import crypto from "node:crypto";
import {
  getField,
  parseRequestBody,
  sendJson,
  setCorsHeaders
} from "./_lib/moderation.mjs";

const safeCompare = (submitted, expected) => {
  const submittedBuffer = Buffer.from(String(submitted));
  const expectedBuffer = Buffer.from(String(expected));

  if (submittedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(submittedBuffer, expectedBuffer);
};

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    setCorsHeaders(response);
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { success: false });
    return;
  }

  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword) {
    sendJson(response, 500, { success: false });
    return;
  }

  let payload;

  try {
    payload = parseRequestBody(request);
  } catch {
    sendJson(response, 400, { success: false });
    return;
  }

  const submittedPassword = getField(payload, ["password", "Password"]);

  if (!submittedPassword) {
    sendJson(response, 400, { success: false });
    return;
  }

  const isValid = safeCompare(submittedPassword, expectedPassword);
  sendJson(response, 200, { success: isValid });
}
