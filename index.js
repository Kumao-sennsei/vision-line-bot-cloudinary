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

app.post("/webhook", express.raw({ type: "*/*" }), (req, res) => {
  const signature = req.headers["x-line-signature"];
  if (!line.validateSignature(req.body, config.channelSecret, signature)) {
    return res.status(401).send("Invalid signature");
  }

  const events = JSON.parse(req.body).events;
  Promise.all(events.map(handleEvent))
    .then(() => res.status(200).end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "image") {
    return Promise.resolve(null);
  }

  try {
    const stream = await client.getMessageContent(event.message.id);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const base64Image = buffer.toString("base64");

    const uploadResponse = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${base64Image}`,
      { folder: "line_bot" }
    );

    const imageUrl = uploadResponse.secure_url;

    const visionResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "あなたは優しい先生です。画像に写っている内容を生徒に説明してください。",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const aiReply = visionResponse.data.choices[0].message.content;

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: aiReply,
    });
  } catch (error) {
    console.error("Error:", error);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "画像の処理中にエラーが発生しました。",
    });
  }
}

app.listen(port, () => {
  console.log(`サーバー起動中 on port ${port}`);
});