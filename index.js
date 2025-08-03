require("dotenv").config();
const express = require("express");
const { middleware, Client } = require("@line/bot-sdk");
const axios = require("axios");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new Client(config);

app.post("/webhook", middleware(config), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === "message" && event.message.type === "image") {
      try {
        const stream = await client.getMessageContent(event.message.id);
        const tempPath = path.join(__dirname, "temp.jpg");
        const writeStream = fs.createWriteStream(tempPath);
        stream.pipe(writeStream).on("close", async () => {
          try {
            const uploadRes = await cloudinary.uploader.upload(tempPath, {
              folder: "vision-bot"
            });
            fs.unlinkSync(tempPath);

            const imageUrl = uploadRes.secure_url;

            const gptRes = await axios.post("https://api.openai.com/v1/chat/completions", {
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: "あなたは優しくて丁寧な数学の先生です。生徒に対して、読みやすく整った数式と、親しみやすく丁寧な解説をしてください。"
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "image_url",
                      image_url: { url: imageUrl }
                    }
                  ]
                }
              ]
            }, {
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
              }
            });

            await client.replyMessage(event.replyToken, {
              type: "text",
              text: gptRes.data.choices[0].message.content
            });
          } catch (err) {
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: "画像の処理中にエラーが発生しました。"
            });
          }
        });
      } catch (err) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "画像の取得に失敗しました。"
        });
      }
    }
  }
  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));