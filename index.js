const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();
const app = express();
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;

// LINE SDK設定
const line = require("@line/bot-sdk");
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

// GoFileアップロード関数
async function uploadToGofile(base64Image) {
  const response = await axios.get("https://api.gofile.io/getServer");
  const server = response.data.data.server;
  const uploadUrl = `https://${server}.gofile.io/uploadBase64`;

  const result = await axios.post(uploadUrl, {
    file: base64Image,
  });

  return result.data.data.downloadPage;
}

// Webhookエンドポイント
app.post("/webhook", line.middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then((result) =>
    res.json(result)
  );
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "image") {
    return Promise.resolve(null);
  }

  const messageId = event.message.id;

  const stream = await client.getMessageContent(messageId);
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  const base64Image = buffer.toString("base64");

  try {
    const imageUrl = await uploadToGofile(base64Image);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `✅ 画像を受け取りました！
アップロードURL：${imageUrl}`,
    });
  } catch (err) {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "⚠️ エラーが発生しました（GoFileアップロード失敗）",
    });
  }
}

app.listen(PORT, () => {
  console.log(`🚀 GoFile対応サーバー起動中 on port ${PORT}`);
});