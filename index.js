require("dotenv").config();
const express = require("express");
const axios = require("axios");
const line = require("@line/bot-sdk");
const rawBodySaver = require("raw-body");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000;

// Cloudinary設定
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
const CLOUDINARY_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// LINEの署名検証用
app.post("/webhook", express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}), (req, res) => {
  const signature = crypto
    .createHmac("SHA256", config.channelSecret)
    .update(req.rawBody).digest("base64");

  const checkHeader = req.get("X-Line-Signature");

  if (signature !== checkHeader) {
    return res.status(401).send("Unauthorized");
  }

  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// Event処理
async function handleEvent(event) {
  if (event.type !== "message") return null;

  const message = event.message;

  // テキストメッセージなら「画像送ってね」と返信
  if (message.type === "text") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "画像を送ってね📷",
    });
  }

  // 画像の場合
  if (message.type === "image") {
    try {
      // LINEサーバーから画像を取得
      const stream = await client.getMessageContent(message.id);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const imageBuffer = Buffer.concat(chunks);
      const base64Image = imageBuffer.toString("base64");

      // Cloudinaryにアップロード
      const cloudinaryRes = await axios.post(CLOUDINARY_URL, {
        file: `data:image/jpeg;base64,${base64Image}`,
        upload_preset: CLOUDINARY_PRESET,
      });

      const imageUrl = cloudinaryRes.data.secure_url;

      // Vision APIへ送信
      const visionRes = await axios.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "この画像の内容をやさしく解説してください" },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1000,
      }, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });

      const replyText = visionRes.data.choices[0].message.content;

      return client.replyMessage(event.replyToken, {
        type: "text",
        text: replyText,
      });
    } catch (err) {
      console.error("エラー:", err);
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "画像の処理中にエラーが発生しました😢",
      });
    }
  }
}

app.get("/", (req, res) => res.send("Kumao先生Bot is running."));
app.listen(port, () => console.log("Server running on port " + port));
