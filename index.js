const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const fs = require("fs");
const rawBodySaver = (req, res, buf) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString("utf8");
  }
};

require("dotenv").config();
const app = express();
app.use(express.json({ verify: rawBodySaver }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// Webhookエンドポイント
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events || events.length === 0) {
      return res.status(200).end();
    }
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "image") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "画像を送ってね📷",
    });
  }

  try {
    const imageBuffer = await downloadImage(event.message.id);
    const gofileUrl = await uploadToGofile(imageBuffer);
    const visionResponse = await queryVisionAPI(gofileUrl);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "🧠くまお先生の解説：

" + visionResponse,
    });
  } catch (err) {
    console.error("処理エラー:", err);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "画像の処理中にエラーが発生しました…もう一度送ってみてください🙏",
    });
  }
}

async function downloadImage(messageId) {
  const stream = await client.getMessageContent(messageId);
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function uploadToGofile(imageBuffer) {
  const formData = new FormData();
  formData.append("file", new Blob([imageBuffer]), "image.jpg");

  const response = await axios.post("https://store1.gofile.io/uploadFile", formData);
  return response.data.data.downloadPage;
}

async function queryVisionAPI(imageUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  const payload = {
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "この画像をやさしく解説してください。" },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 1000,
  };

  const result = await axios.post("https://api.openai.com/v1/chat/completions", payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  return result.data.choices[0].message.content;
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});