require('dotenv').config();
const express = require('express');
const { middleware, Client } = require('line-bot-sdk');
const getRawBody = require('raw-body');
const uploadImage = require('./uploadImageToCloudinary');

const app = express();
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

app.post('/webhook', middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'image') {
        const buffer = await getRawBody(req);
        const imageUrl = await uploadImage(buffer);
        const reply = { type: 'text', text: `Image uploaded: ${imageUrl}` };
        const client = new Client(config);
        await client.replyMessage(event.replyToken, reply);
      }
    }
    res.status(200).end();
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});