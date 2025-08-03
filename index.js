require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const bodyParser = require('body-parser');
const uploadImageToCloudinary = require('./uploadImageToCloudinary');

const app = express();
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf } }));
app.use(bodyParser.urlencoded({ extended: true }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'image') {
      try {
        const imageBuffer = await client.getMessageContent(event.message.id);
        const chunks = [];
        for await (const chunk of imageBuffer) {
          chunks.push(chunk);
        }
        const imageBase64 = Buffer.concat(chunks).toString('base64');
        const imageUrl = await uploadImageToCloudinary(imageBase64);

        const visionResponse = `画像を受け取りました！URL: ${imageUrl}`;
        await client.replyMessage(event.replyToken, { type: 'text', text: visionResponse });
      } catch (err) {
        await client.replyMessage(event.replyToken, { type: 'text', text: '画像処理中にエラーが発生しました。' });
      }
    } else {
      await client.replyMessage(event.replyToken, { type: 'text', text: '画像を送ってね📷✨' });
    }
  }
  res.status(200).send('OK');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});