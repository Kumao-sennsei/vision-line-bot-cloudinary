require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const FormData = require("form-data");

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
app.use(express.json());

// LINE webhook
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    for (const event of events) {
      if (event.message && event.message.type === "image") {
        const messageId = event.message.id;
        const stream = await client.getMessageContent(messageId);
        const tempPath = `/tmp/${uuidv4()}.jpg`;
        const writable = fs.createWriteStream(tempPath);
        stream.pipe(writable);
        await new Promise((resolve) => writable.on("finish", resolve));

        // GoFileへアップロード
        const form = new FormData();
        form.append("file", fs.createReadStream(tempPath));
        const goRes = await axios.post("https://store1.gofile.io/uploadFile", form, {
          headers: form.getHeaders(),
        });

        const imageUrl = goRes.data.data.downloadPage;

        // OpenAI Vision APIへ送信
        const visionRes = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-4-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "この画像の内容を説明してください。" },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
            max_tokens: 1000,
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
        fs.unlinkSync(tempPath);
      } else if (event.message && event.message.type === "text") {
        await client.replyMessage(event.replyToken, { type: "text", text: "画像を送ってね📷" });
      }
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.status(500).send("Error");
  }
});

app.get("/", (req, res) => res.send("LINE Bot running"));
app.listen(port, () => console.log(`Server running on port ${port}`));
