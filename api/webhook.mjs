import {
  approveReviewById,
  deleteReviewById,
  getTelegramConfig,
  parseRequestBody,
  sanitize,
  sendJson,
  sendTelegramRequest
} from "./_lib/moderation.mjs";

const parseCallbackData = (value) => {
  const normalized = sanitize(value);
  const separatorIndex = normalized.indexOf("_");

  if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) {
    return null;
  }

  return {
    action: normalized.slice(0, separatorIndex),
    reviewId: normalized.slice(separatorIndex + 1)
  };
};

const buildResultMessage = (action, review) => {
  if (action === "approve") {
    return `✅ Відгук схвалено та опубліковано!\n\n👤 ${sanitize(review?.name) || "Користувач"}`;
  }

  return `❌ Видалено\n\n👤 ${sanitize(review?.name) || "Користувач"}`;
};

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { success: false, message: "Method not allowed." });
    return;
  }

  const data = parseRequestBody(request);
  console.log("Callback received:", data);

  let token = "";

  try {
    ({ token } = getTelegramConfig());
  } catch (error) {
    console.log("Webhook env error:", error);
    sendJson(response, 500, { success: false, message: "Missing environment variables." });
    return;
  }

  const callbackQuery = data?.callback_query;
  console.log("Callback query object:", callbackQuery);

  if (!callbackQuery) {
    sendJson(response, 200, { success: true, ignored: true });
    return;
  }

  const callbackData = sanitize(callbackQuery.data);
  const parsedCallback = parseCallbackData(callbackData);

  if (!parsedCallback || !["approve", "delete"].includes(parsedCallback.action)) {
    await sendTelegramRequest(token, "answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Невідома дія.",
      show_alert: false
    });
    sendJson(response, 200, { success: true, ignored: true });
    return;
  }

  const { action, reviewId } = parsedCallback;
  const message = callbackQuery.message;

  console.log("Parsed callback action:", action);
  console.log("Parsed callback review ID:", reviewId);

  try {
    const mutationResult =
      action === "approve"
        ? await approveReviewById(reviewId)
        : await deleteReviewById(reviewId);

    const { data: review, error, status } = mutationResult || {};

    if (status && (status < 200 || status > 204)) {
      console.log("Supabase mutation returned unexpected status:", status, {
        action,
        reviewId,
        error
      });
    }

    if (error) {
      console.log("Supabase mutation error:", {
        action,
        reviewId,
        status,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    if (!review) {
      await sendTelegramRequest(token, "answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "Відгук вже оброблено або не знайдено.",
        show_alert: false
      });
      sendJson(response, 200, { success: true, handled: false });
      return;
    }

    await sendTelegramRequest(token, "answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: action === "approve" ? "✅ Схвалено" : "❌ Видалено",
      show_alert: false
    });

    if (message?.chat?.id && message?.message_id) {
      await sendTelegramRequest(token, "editMessageText", {
        chat_id: message.chat.id,
        message_id: message.message_id,
        text: buildResultMessage(action, review)
      });
      console.log("Telegram message updated after moderation:", {
        action,
        reviewId,
        chatId: message.chat.id,
        messageId: message.message_id
      });
    }

    sendJson(response, 200, {
      success: true,
      action,
      id: reviewId
    });
  } catch (error) {
    console.log("Webhook processing error:", error);

    try {
      await sendTelegramRequest(token, "answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "Помилка обробки модерації.",
        show_alert: true
      });
    } catch (telegramError) {
      console.log("Callback answer error:", telegramError);
    }

    sendJson(response, 500, {
      success: false,
      message: "Failed to process callback."
    });
  }
}
