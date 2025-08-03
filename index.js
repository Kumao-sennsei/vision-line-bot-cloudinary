require("dotenv").config();
const express = require("express");
const { middleware, Client } = require("@line/bot-sdk");
const { uploadImageToCloudinary } = require("./uploadImageToCloudinary");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 8080;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

app.post("/webhook", middleware(config), async (req, res) => {
  console.log("📩 受信したイベント:", JSON.stringify(req.body, null, 2)); // 追加ログ
  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "image") {
      try {
        const messageId = event.message.id;
        console.log("🖼 画像メッセージID:", messageId);

        const imageResponse = await axios.get(
          `https://api-data.line.me/v2/bot/message/${messageId}/content`,
          {
            responseType: "arraybuffer",
            headers: {
              Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            },
          }
        );

        const imageBuffer = Buffer.from(imageResponse.data, "binary");
        const base64Image = imageBuffer.toString("base64");

        console.log("📤 Cloudinaryにアップロード開始...");
        const imageUrl = await uploadImageToCloudinary(base64Image);
        console.log("✅ Cloudinaryアップロード成功:", imageUrl);

        const visionRes = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "この画像の内容をやさしく説明して下さい。" },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        const replyText = visionRes.data.choices[0].message.content;
        await client.replyMessage(event.replyToken, { type: "text", text: replyText });
      } catch (err) {
        console.error("❌ エラー:", err);
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "画像の処理中にエラーが発生しました。",
        });
      }
    }
  }

  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`🚀 Server running at port ${port}`);
});
