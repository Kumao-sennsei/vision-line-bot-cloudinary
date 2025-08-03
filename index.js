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

async function uploadToGofile(buffer) {
  const form = new FormData();
  form.append("file", buffer, "image.jpg");

  const response = await axios.post("https://store1.gofile.io/uploadFile", form, {
    headers: form.getHeaders(),
  });

  return response.data.data.downloadPage;
}

async function callVisionAPI(imageUrl) {
  const response = await axios.post("https://api.openai.com/v1/chat/completions", {
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
  }, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  });

  return response.data.choices[0].message.content;
}

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
          text: "画像を送ってくれたら解説するよ📷✨",
        });
      }

      if (message.type === "image") {
        try {
          const stream = await client.getMessageContent(message.id);
          const chunks = [];

          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("end", async () => {
            const buffer = Buffer.concat(chunks);
            const gofileUrl = await uploadToGofile(buffer);
            const visionResponse = await callVisionAPI(gofileUrl);

            await client.replyMessage(event.replyToken, {
              type: "text",
              text: visionResponse || "画像の解説がうまくできなかったみたい…もう一度送ってね🙏",
            });
          });

          stream.on("error", (err) => {
            console.error("画像取得エラー:", err);
          });
        } catch (err) {
          console.error("画像処理中にエラー:", err);
          return client.replyMessage(event.replyToken, {
            type: "text",
            text: "画像の処理中にエラーが発生しました💦もう一度試してみてね🙏",
          });
        }
      }
    });

    await Promise.all(promises);
    res.status(200).send("OK");
  } catch (error) {
    console.error("全体エラー:", error);
    res.status(500).send("エラーが発生しました");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
