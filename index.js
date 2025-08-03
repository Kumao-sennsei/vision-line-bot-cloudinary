
require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
app.use(express.json({ limit: "10mb" }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    const results = await Promise.all(events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).end();
  }
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

    console.log("✅ Base64変換成功");

    const uploadRes = await uploadToCloudinary(base64Image);
    console.log("✅ Cloudinaryアップロード成功:", uploadRes.secure_url);

    const visionRes = await askOpenAIVision(uploadRes.secure_url);
    console.log("✅ Vision API応答成功");

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `くまお先生の解説です🐻✨

${visionRes}`,
    });
  } catch (error) {
    console.error("❌ handleEvent error:", error);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "画像の処理中にエラーが発生しました🙇‍♂️",
    });
  }
}

async function uploadToCloudinary(base64) {
  const form = new FormData();
  form.append("file", `data:image/png;base64,${base64}`);
  form.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET);

  const res = await axios.post(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    form,
    { headers: form.getHeaders() }
  );

  return res.data;
}

async function askOpenAIVision(imageUrl) {
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "この画像をやさしく解説してください。" },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 1000,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  );

  return res.data.choices[0].message.content;
}

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log("🚀 Server running at port", port);
});
