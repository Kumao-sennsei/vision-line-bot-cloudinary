require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const FormData = require("form-data");
const getRawBody = require("raw-body");

const app = express();
const port = process.env.PORT || 3000;

// LINE config
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

// LINE signature middleware with raw-body
app.post("/webhook", (req, res, next) => {
  getRawBody(req)
    .then((buf) => {
      req.rawBody = buf;
      line.middleware(config)(req, res, next);
    })
    .catch((err) => {
      console.error("Raw body parse error:", err.message);
      res.status(500).send("Raw body error");
    });
}, async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.message && event.message.type === "image") {
      const messageId = event.message.id;
      const stream = await client.getMessageContent(messageId);

      const tempPath = `/tmp/${uuidv4()}.jpg`;
      const writable = fs.createWriteStream(tempPath);
      stream.pipe(writable);
      await new Promise((resolve) => writable.on("finish", resolve));

      const form = new FormData();
      form.append("file", fs.createReadStream(tempPath));
      form.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET);
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
      const uploadRes = await axios.post(cloudinaryUrl, form, {
        headers: form.getHeaders(),
      });

      const imageUrl = uploadRes.data.secure_url;

      const visionRes = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "この画像の内容を説明して下さい。" },
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
      await client.replyMessage(event.replyToken, { type: "text", text: "画像を送ってね📸" });
    }
  }
  res.status(200).send("OK");
});

app.get("/", (req, res) => res.send("LINE Vision Bot is up!"));
app.listen(port, () => console.log(`Server running on port ${port}`));
