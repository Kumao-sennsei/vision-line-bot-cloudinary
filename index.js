
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "image") {
    return Promise.resolve(null);
  }

  const stream = await client.getMessageContent(event.message.id);
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  stream.on("end", async () => {
    const buffer = Buffer.concat(chunks);
    const response = await axios.post("https://store1.gofile.io/uploadFile", buffer, {
      headers: { "Content-Type": "application/octet-stream" },
    });
    const imageUrl = response.data.data.downloadPage;

    const replyMessage = {
      type: "text",
      text: `画像アップロード成功✨ URLはこちら→ ${imageUrl}`,
    };

    client.replyMessage(event.replyToken, replyMessage);
  });
}

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 GoFile対応サーバー起動中 on port ${port}`);
});
