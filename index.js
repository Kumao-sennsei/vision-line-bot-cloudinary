const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const dotenv = require("dotenv");
const rawBodySaver = require("raw-body");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// Cloudinary設定
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Vision API用
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/webhook", express.json({ verify: (req, res, buf) => req.rawBody = buf }),
  line.middleware(config),
  (req, res) => {
    Promise.all(req.body.events.map(handleEvent)).then((result) => res.json(result));
  }
);

async function handleEvent(event) {
  if (event.type !== "message" || (event.message.type !== "image" && event.message.type !== "text")) {
    return Promise.resolve(null);
  }

  if (event.message.type === "text") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `くまお先生です🐻 ご質問ありがとうございます！

👉「${event.message.text}」ですね？

いま画像がないので、できれば画像を送ってもらえると助かります📷✨`,
    });
  }

  try {
    const stream = await client.getMessageContent(event.message.id);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const uploaded = await cloudinary.uploader.upload_stream({ resource_type: "image" }, async (error, result) => {
      if (error) throw error;

      const imageUrl = result.secure_url;

      const visionRes = await axios.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "あなたは優しい先生です。生徒が送った画像を見て、分かりやすく丁寧に日本語で解説してください。",
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl } },
              { type: "text", text: "この画像を説明してください。" },
            ],
          },
        ],
        temperature: 0.7,
      }, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const answer = visionRes.data.choices[0].message.content;

      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `📷画像を受け取りました！

${answer}`,
      });
    });

    const passthrough = require("stream").PassThrough();
    passthrough.end(buffer);
    passthrough.pipe(uploaded);
  } catch (err) {
    console.error("Error handling image:", err);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "画像の処理中にエラーが発生しました🙏",
    });
  }
}

app.listen(port, () => {
  console.log(`🟢 サーバー起動中 on port ${port}`);
});
