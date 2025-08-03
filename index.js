require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const FormData = require("form-data");

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);
app.use(express.json());

// LINE Webhook
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    for (const event of events) {
      if (event.message && event.message.type === "image") {
        const messageId = event.message.id;
        const stream = await client.getMessageContent(messageId);

        // Save image to temp file
        const tempPath = `/tmp/${uuidv4()}.jpg`;
        const writable = fs.createWriteStream(tempPath);
        stream.pipe(writable);
        await new Promise((resolve) => writable.on("finish", resolve));

        // Upload to Cloudinary
        const cloudinaryUrl = "https://api.cloudinary.com/v1_1/" + process.env.CLOUDINARY_CLOUD_NAME + "/image/upload";
        const form = new FormData();
        form.append("file", fs.createReadStream(tempPath));
        form.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET);

        const uploadRes = await axios.post(cloudinaryUrl, form, {
          headers: form.getHeaders(),
        });
        const imageUrl = uploadRes.data.secure_url;

        // Send to OpenAI Vision
        const visionRes = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: "gpt-4-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "この画像の内容を詳しく説明してください。" },
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
        fs.unlinkSync(tempPath); // Cleanup
      } else if (event.message && event.message.type === "text") {
        await client.replyMessage(event.replyToken, { type: "text", text: "画像を送ってください📷" });
      }
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.status(500).send("Error");
  }
});

app.get("/", (req, res) => res.send("LINE Vision Bot is running"));
app.listen(port, () => console.log(`Server running on port ${port}`));
