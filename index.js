require('dotenv').config();
const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const bodyParser = require('body-parser');
const axios = require('axios');
const uploadImageToCloudinary = require('./uploadImageToCloudinary');

const app = express();

app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(middleware({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
}));

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

app.post('/webhook', async (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then(result => res.json(result));
});

async function handleEvent(event) {
  if (event.type !== 'message') return;

  if (event.message.type === 'text') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '画像を送ってくれたら解説するね📷✨'
    });
  }

  if (event.message.type === 'image') {
    try {
      const imageBuffer = await client.getMessageContent(event.message.id);
      const chunks = [];
      for await (const chunk of imageBuffer) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const imageUrl = await uploadImageToCloudinary(buffer);

      const visionRes = await axios.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "この画像を説明してください。" },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 1000
      }, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      });

      const aiReply = visionRes.data.choices[0].message.content;

      return client.replyMessage(event.replyToken, {
        type: "text",
        text: aiReply
      });
    } catch (err) {
      console.error("画像処理エラー:", err);
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "画像の処理中にエラーが発生しました💦"
      });
    }
  }
}

app.listen(3000, () => {
  console.log('LINE bot is running.');
});