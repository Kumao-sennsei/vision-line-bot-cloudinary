require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const uploadImageToCloudinary = require("./uploadImageToCloudinary");

const app = express();
app.use(express.json({ verify: (req, res, buf) => (req.rawBody = buf) }));
app.use(express.urlencoded({ extended: true }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === "message" && event.message.type === "image") {
      try {
        const messageId = event.message.id;
        const stream = await client.getMessageContent(messageId);
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const base64Image = buffer.toString("base64");
        const imageUrl = await uploadImageToCloudinary(base64Image);

        const visionRes = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", content: "この画像をやさしく丁寧に説明してください。" },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
          }
        );

        const replyText = visionRes.data.choices[0].message.content;
        await client.replyMessage(event.replyToken, { type: "text", text: replyText });
      } catch (err) {
        console.error(err);
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "画像の処理中にエラーが発生しました。",
        });
      }
    } else {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "画像を送ってくださいね📷✨",
      });
    }
  }
  res.status(200).end();
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});