const TELEGRAM_API_BASE = "https://api.telegram.org";

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});

const sanitize = (value) => String(value || "").trim();

const parseEventBody = (event) => {
  const rawBody = event.body;
  const contentType = sanitize(event.headers?.["content-type"] || event.headers?.["Content-Type"]).toLowerCase();

  console.log("Raw body received:", rawBody);
  console.log("Content-Type received:", contentType || "not provided");

  if (!rawBody) {
    return {};
  }

  if (typeof rawBody === "object") {
    return rawBody;
  }

  if (typeof rawBody === "string") {
    const trimmed = rawBody.trim();

    if (!trimmed) {
      return {};
    }

    if (contentType.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return JSON.parse(trimmed);
    }

    const params = new URLSearchParams(trimmed);
    return Object.fromEntries(params.entries());
  }

  return {};
};

const buildGenericMessage = (payload) => {
  const entries = Object.entries(payload || {}).filter(([key]) => key !== "company");

  if (!entries.length) {
    return "Порожня заявка";
  }

  return entries
    .map(([key, value]) => `${key}: ${sanitize(value) || "Не вказано"}`)
    .join("\n");
};

const getField = (payload, keys) => {
  for (const key of keys) {
    const value = sanitize(payload?.[key]);
    if (value) {
      return value;
    }
  }

  return "";
};

const ratingToStars = (ratingValue) => {
  const normalized = Number.parseInt(sanitize(ratingValue), 10);

  if (!Number.isFinite(normalized) || normalized < 1) {
    return "Не вказано";
  }

  return "⭐".repeat(Math.min(normalized, 5));
};

const buildBookingMessage = ({ name, phone, format }) =>
  [
    "⚡ НОВИЙ ЗАПИС: PowerPlace",
    "━━━━━━━━━━━━━━",
    `👤 Клієнт: ${sanitize(name) || "Не вказано"}`,
    `📞 Телефон: ${sanitize(phone) || "Не вказано"}`,
    `📅 Формат: ${sanitize(format) || "Не вказано"}`
  ].join("\n");

const buildReviewMessage = ({ name, rating, text }) =>
  [
    "⭐ НОВИЙ ВІДГУК: PowerPlace",
    "━━━━━━━━━━━━━━",
    `👤 Від: ${sanitize(name) || "Не вказано"}`,
    `📊 Оцінка: ${ratingToStars(rating)}`,
    `💬 Текст: ${sanitize(text) || "Не вказано"}`
  ].join("\n");

exports.handler = async (event) => {
  console.log("FUNCTION TRIGGERED");
  console.log("HTTP method:", event.httpMethod);

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { success: false, message: "Method not allowed." });
  }

  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("Missing environment variables.", {
      hasToken: Boolean(token),
      hasChatId: Boolean(chatId)
    });
    return jsonResponse(500, {
      success: false,
      message: "Missing environment variables"
    });
  }

  let payload;

  try {
    payload = parseEventBody(event);
    console.log("Parsed payload:", payload);
  } catch (error) {
    console.log("Body parsing error:", error);
    return jsonResponse(400, {
      success: false,
      message: "Invalid request body."
    });
  }

  const formType = sanitize(payload.formType);
  const company = sanitize(payload.company);

  if (company) {
    return jsonResponse(400, {
      success: false,
      message: "Request rejected by honeypot."
    });
  }

  let text = "";

  if (formType === "booking") {
    const name = getField(payload, ["name", "Ім'я"]);
    const phone = getField(payload, ["phone", "Телефон"]);
    const format = getField(payload, ["format", "Послуга", "Формат"]);

    if (!name && !phone && !format) {
      text = "Порожня заявка";
    } else {
      text = buildBookingMessage({ name, phone, format });
    }
  } else if (formType === "review") {
    const name = getField(payload, ["name", "Ім'я"]);
    const rating = getField(payload, ["rating", "Оцінка"]);
    const reviewText = getField(payload, ["text", "Текст_відгуку", "Текст"]);

    if (!name && !reviewText && !rating) {
      text = "Порожня заявка";
    } else {
      text = buildReviewMessage({ name, rating, text: reviewText });
    }
  } else {
    text = buildGenericMessage(payload);
  }

  if (!sanitize(text)) {
    text = "Порожня заявка";
  }

  console.log("Token visible to server:", token ? `${token.slice(0, 10)}...` : "missing");
  console.log("Chat ID visible to server:", chatId || "missing");
  console.log("Telegram text to send:", text);

  try {
    const telegramResponse = await fetch(
      `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text
        })
      }
    );

    const telegramResult = await telegramResponse.json();
    console.log("Telegram status:", telegramResponse.status);
    console.log("Telegram response:", telegramResult);

    if (!telegramResponse.ok || !telegramResult.ok) {
      return jsonResponse(502, {
        success: false,
        message: telegramResult.description || "Failed to send Telegram message."
      });
    }

    return jsonResponse(200, {
      success: true
    });
  } catch (error) {
    console.log("Telegram request error:", error);
    return jsonResponse(500, {
      success: false,
      message: "Internal server error."
    });
  }
};
