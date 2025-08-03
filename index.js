const express = require("express");
const line = require("@line/bot-sdk");
const uploadImageToCloudinary = require("./uploadImageToCloudinary");
require("dotenv").config();

const app = express();
app.use(express.json({ limit: "10mb" }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;
  if (!Array.isArray(events)) {
    return res.status(500).end();
  }

  const results = await Promise.all(
    events.map(async (event) => {
      if (event.type !== "message" || event.message.type !== "image") {
        return;
      }

      try {
        const stream = await client.getMessageContent(event.message.id);
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);
        const base64Image = imageBuffer.toString("base64");
        const dataUrl = `data:image/jpeg;base64,${base64Image}`;

        const imageUrl = await uploadImageToCloudinary(dataUrl);
        console.log("Uploaded to:", imageUrl);

        await client.replyMessage(event.replyToken, {
          type: "text",
          text: `画像を受け取りました！
Cloudinary URL:
${imageUrl}`,
        });
      } catch (error) {
        console.error("Error processing image:", error);
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "画像の処理中にエラーが発生しました💦",
        });
      }
    })
  );

  res.json(results);
});

app.listen(8080, () => {
  console.log("📡 Server running at port 8080");
});
