const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const dotenv = require("dotenv");
const uploadImageToCloudinary = require("./uploadImageToCloudinary");
const rawBodySaver = require("raw-body");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post("/webhook", express.json({ verify: (req, res, buf) => { req.rawBody = buf; }}), (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then(() => res.end()).catch((err) => {
    console.error(err);
    res.status(500).end();
  });
});

async function handleEvent(event) {
  if (event.type === "message" && event.message.type === "image") {
    const stream = await client.getMessageContent(event.message.id);
    const buffer = await rawBodySaver(stream);

    const base64Image = buffer.toString("base64");
    const imageUrl = await uploadImageToCloudinary(base64Image);

    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "画像について詳しく教えてください(●´ω｀●)" },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 500
      },
      {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
      }
    );

    const messageText = aiResponse.data.choices[0].message.content;

    return client.replyMessage(event.replyToken, { type: "text", text: messageText });

  } else {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "画像を送ってね！(●´ω｀●)",
    });
  }
}

app.listen(port, () => console.log(`🚀 サーバー起動中 on port ${port}`));