import { createClient } from "@supabase/supabase-js";

export const TELEGRAM_API_BASE = "https://api.telegram.org";
const REVIEWS_TABLE = "reviews";

export const sanitize = (value) => String(value || "").trim();

export const setCorsHeaders = (response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
};

export const sendJson = (response, statusCode, body) => {
  setCorsHeaders(response);
  response.status(statusCode).json(body);
};

export const parseRequestBody = (request) => {
  const rawBody = request.body;
  const contentType = sanitize(request.headers?.["content-type"] || request.headers?.["Content-Type"]).toLowerCase();

  if (!rawBody) {
    return {};
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

  if (typeof rawBody === "object") {
    return rawBody;
  }

  return {};
};

export const getField = (payload, keys) => {
  for (const key of keys) {
    const value = sanitize(payload?.[key]);
    if (value) {
      return value;
    }
  }

  return "";
};

export const ratingToStars = (ratingValue) => {
  const normalized = Number.parseInt(sanitize(ratingValue), 10);

  if (!Number.isFinite(normalized) || normalized < 1) {
    return "Не вказано";
  }

  return "⭐".repeat(Math.min(normalized, 5));
};

export const parseRatingValue = (ratingValue) => {
  const normalized = Number.parseInt(sanitize(ratingValue), 10);
  return Number.isFinite(normalized) && normalized > 0 ? Math.min(normalized, 5) : null;
};

export const buildGenericMessage = (payload) => {
  const entries = Object.entries(payload || {}).filter(([key]) => key !== "company");

  if (!entries.length) {
    return "Порожня заявка";
  }

  return entries
    .map(([key, value]) => `${key}: ${sanitize(value) || "Не вказано"}`)
    .join("\n");
};

export const buildBookingMessage = ({ name, phone, format }) =>
  [
    "⚡ НОВИЙ ЗАПИС: PowerPlace",
    "━━━━━━━━━━━━━━",
    `👤 Клієнт: ${sanitize(name) || "Не вказано"}`,
    `📞 Телефон: ${sanitize(phone) || "Не вказано"}`,
    `📅 Формат: ${sanitize(format) || "Не вказано"}`
  ].join("\n");

export const buildReviewModerationMessage = ({ id, name, rating, text }) =>
  [
    "⭐ НОВИЙ ВІДГУК: PowerPlace",
    "━━━━━━━━━━━━━━",
    `🆔 ID: ${sanitize(id) || "Не вказано"}`,
    `👤 Від: ${sanitize(name) || "Не вказано"}`,
    `📊 Оцінка: ${ratingToStars(rating)}`,
    `💬 Текст: ${sanitize(text) || "Не вказано"}`,
    "",
    "Оберіть дію нижче:"
  ].join("\n");

export const getTelegramConfig = () => {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  }

  return { token, chatId };
};

export const getSupabaseAdminClient = () => {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export const createPendingReview = async ({ name, rating, text }) => {
  const supabase = getSupabaseAdminClient();
  const normalizedRating = parseRatingValue(rating);

  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .insert([
      {
        name: sanitize(name),
        rating: normalizedRating,
        text: sanitize(text),
        is_approved: false
      }
    ])
    .select("id, name, rating, text, is_approved")
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const getApprovedReviews = async () => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select("id, name, rating, text, created_at")
    .eq("is_approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
};

export const approveReviewById = async (reviewId) => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .update({ is_approved: true })
    .eq("id", reviewId)
    .select("id, name, rating, text, is_approved")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

export const deleteReviewById = async (reviewId) => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .delete()
    .eq("id", reviewId)
    .select("id, name, rating, text")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

export const sendTelegramRequest = async (token, method, payload) => {
  const telegramResponse = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const telegramResult = await telegramResponse.json();

  if (!telegramResponse.ok || !telegramResult.ok) {
    throw new Error(telegramResult.description || `Telegram API error for ${method}`);
  }

  return telegramResult;
};
