
require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");

const app = express();
app.use(express.json({ limit: "10mb" }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === "message") {
      const message = event.message;
      if (message.type === "image") {
        try {
          const imageStream = await client.getMessageContent(message.id);
          let chunks = [];
          imageStream.on("data", (chunk) => chunks.push(chunk));
          imageStream.on("end", async () => {
            const buffer = Buffer.concat(chunks);
            const base64 = buffer.toString("base64");
            const dataUri = `data:image/jpeg;base64,${base64}`;
            const uploadRes = await cloudinary.uploader.upload(dataUri);
            const imageUrl = uploadRes.secure_url;

            const aiResponse = await axios.post("https://api.openai.com/v1/chat/completions", {
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: "あなたは画像を見て、優しく丁寧に説明してくれる先生です。",
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
                    {
                      type: "text",
                      text: "この画像を見て、詳しく解説してください。",
                    },
                  ],
                },
              ],
            }, {
              headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
            });

            const replyText = aiResponse.data.choices[0].message.content;
            await client.replyMessage(event.replyToken, { type: "text", text: replyText });
          });
        } catch (error) {
          console.error("Image error:", error.message);
          await client.replyMessage(event.replyToken, { type: "text", text: "画像の処理中にエラーが発生しました。" });
        }
      } else {
        await client.replyMessage(event.replyToken, { type: "text", text: "画像を送ってくださいね📷✨" });
      }
    }
  }
  res.status(200).end();
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at port ${port}`);
});
