import {
  buildBookingMessage,
  buildGenericMessage,
  buildReviewModerationMessage,
  createPendingReview,
  getField,
  getTelegramConfig,
  parseRequestBody,
  sanitize,
  sendJson,
  sendTelegramRequest,
  setCorsHeaders
} from "./_lib/moderation.mjs";

export default async function handler(request, response) {
  console.log("FUNCTION TRIGGERED");
  console.log("HTTP method:", request.method);

  if (request.method === "OPTIONS") {
    setCorsHeaders(response);
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { success: false, message: "Method not allowed." });
    return;
  }

  let token = "";
  let chatId = "";

  try {
    ({ token, chatId } = getTelegramConfig());
  } catch (error) {
    console.log("Missing environment variables.", error);
    sendJson(response, 500, {
      success: false,
      message: "Missing environment variables."
    });
    return;
  }

  let payload;

  try {
    payload = parseRequestBody(request);
    console.log("Parsed payload:", payload);
  } catch (error) {
    console.log("Body parsing error:", error);
    sendJson(response, 400, {
      success: false,
      message: "Invalid request body."
    });
    return;
  }

  const formType = sanitize(payload.formType);
  const company = sanitize(payload.company);

  if (company) {
    sendJson(response, 400, {
      success: false,
      message: "Request rejected by honeypot."
    });
    return;
  }

  let telegramPayload = null;

  if (formType === "booking") {
    const name = getField(payload, ["name", "Ім'я"]);
    const phone = getField(payload, ["phone", "Телефон"]);
    const format = getField(payload, ["format", "Послуга", "Формат"]);
    const text = !name && !phone && !format ? "Порожня заявка" : buildBookingMessage({ name, phone, format });
    telegramPayload = { chat_id: chatId, text };
  } else if (formType === "review") {
    const name = getField(payload, ["name", "Ім'я"]);
    const rating = getField(payload, ["rating", "Оцінка"]);
    const reviewText = getField(payload, ["text", "Текст_відгуку", "Текст"]);

    if (!name && !reviewText && !rating) {
      telegramPayload = {
        chat_id: chatId,
        text: "Порожня заявка"
      };
    } else {
      let reviewRecord;

      try {
        reviewRecord = await createPendingReview({ name, rating, text: reviewText });
      } catch (error) {
        console.log("Supabase insert error:", error);
        sendJson(response, 500, {
          success: false,
          message: "Не вдалося зберегти відгук для модерації."
        });
        return;
      }

      telegramPayload = {
        chat_id: chatId,
        text: buildReviewModerationMessage({
          id: reviewRecord.id,
          name: reviewRecord.name,
          rating: reviewRecord.rating,
          text: reviewRecord.text
        }),
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Одобрити", callback_data: `approve_${reviewRecord.id}` },
              { text: "❌ Видалити", callback_data: `delete_${reviewRecord.id}` }
            ]
          ]
        }
      };
    }
  } else {
    telegramPayload = {
      chat_id: chatId,
      text: buildGenericMessage(payload)
    };
  }

  console.log("Token visible to server:", token ? `${token.slice(0, 10)}...` : "missing");
  console.log("Chat ID visible to server:", chatId || "missing");
  console.log("Telegram text to send:", telegramPayload?.text || "missing");

  try {
    await sendTelegramRequest(token, "sendMessage", telegramPayload);

    sendJson(response, 200, {
      success: true
    });
  } catch (error) {
    console.log("Telegram request error:", error);
    sendJson(response, 500, {
      success: false,
      message: "Internal server error."
    });
  }
}
