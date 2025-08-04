require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const rawBody = require("raw-body");
const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

app.post("/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  const signature = req.headers["x-line-signature"];
  const body = req.body.toString();

  if (!line.validateSignature(body, config.channelSecret, signature)) {
    return res.status(401).send("Unauthorized");
  }

  const events = JSON.parse(body).events;
  const results = await Promise.all(events.map(handleEvent));
  res.json(results);
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "image") return;

  try {
    const stream = await client.getMessageContent(event.message.id);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const goFileRes = await axios.post("https://store1.gofile.io/uploadFile", buffer, {
      headers: { "Content-Type": "application/octet-stream" },
    });

    const imageUrl = goFileRes.data.data.downloadPage;

    const visionRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", content: "この画像をやさしく解説してください。" },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1000,
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
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
}

app.get("/", (req, res) => res.send("OK"));
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});