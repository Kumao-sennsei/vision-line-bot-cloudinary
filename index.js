const express = require("express");
const line = require("@line/bot-sdk");
const getRawBody = require("raw-body");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 8080;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post("/webhook", async (req, res) => {
  try {
    const body = await getRawBody(req);
    const signature = req.headers["x-line-signature"];

    if (!line.validateSignature(body, config.channelSecret, signature)) {
      return res.status(401).send("Invalid signature.");
    }

    const parsedBody = JSON.parse(body.toString("utf8"));
    const events = parsedBody.events;

    const promises = events.map(async (event) => {
      if (event.type !== "message") return;
      const message = event.message;

      if (message.type === "text") {
        return client.replyMessage(event.replyToken, {
          type: "text",
          text: "画像を送ってね！📷✨",
        });
      }

      if (message.type === "image") {
        return client.replyMessage(event.replyToken, {
          type: "text",
          text: "画像を受け取ったよ！（※画像処理はまだ未実装だよ）",
        });
      }
    });

    await Promise.all(promises);
    res.status(200).send("OK");
  } catch (error) {
    console.error("エラー:", error);
    res.status(500).send("エラーが発生しました");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
