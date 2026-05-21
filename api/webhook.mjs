import {
  approveReviewById,
  deleteReviewById,
  getTelegramConfig,
  parseRequestBody,
  sanitize,
  sendJson,
  sendTelegramRequest
} from "./_lib/moderation.mjs";

const CALLBACK_PATTERN = /^(approve|delete)_(.+)$/;

const buildResultMessage = (action, review) => {
  if (action === "approve") {
    return `✅ Відгук опубліковано на сайті!\n\n👤 ${sanitize(review?.name) || "Користувач"}`;
  }

  return `🗑️ Відгук видалено.\n\n👤 ${sanitize(review?.name) || "Користувач"}`;
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

  let token = "";

  try {
    ({ token } = getTelegramConfig());
  } catch (error) {
    console.log("Webhook env error:", error);
    sendJson(response, 500, { success: false, message: "Missing environment variables." });
    return;
  }

  const payload = parseRequestBody(request);
  const callbackQuery = payload?.callback_query;

  if (!callbackQuery) {
    sendJson(response, 200, { success: true, ignored: true });
    return;
  }

  const callbackData = sanitize(callbackQuery.data);
  const match = callbackData.match(CALLBACK_PATTERN);

  if (!match) {
    await sendTelegramRequest(token, "answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Невідома дія.",
      show_alert: false
    });
    sendJson(response, 200, { success: true, ignored: true });
    return;
  }

  const [, action, reviewId] = match;
  const message = callbackQuery.message;

  try {
    const review =
      action === "approve"
        ? await approveReviewById(reviewId)
        : await deleteReviewById(reviewId);

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
      text: action === "approve" ? "Відгук опубліковано." : "Відгук видалено.",
      show_alert: false
    });

    if (message?.chat?.id && message?.message_id) {
      await sendTelegramRequest(token, "editMessageText", {
        chat_id: message.chat.id,
        message_id: message.message_id,
        text: buildResultMessage(action, review)
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
