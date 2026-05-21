import {
  getApprovedReviews,
  sendJson,
  setCorsHeaders
} from "./_lib/moderation.mjs";

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    setCorsHeaders(response);
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { success: false, message: "Method not allowed." });
    return;
  }

  try {
    const reviews = await getApprovedReviews();
    sendJson(response, 200, {
      success: true,
      reviews
    });
  } catch (error) {
    console.log("Get reviews error:", error);
    sendJson(response, 500, {
      success: false,
      message: "Failed to load approved reviews."
    });
  }
}
