const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const axios = require('axios');
const dotenv = require('dotenv');
const rawBodySaver = require('raw-body');
const fs = require('fs');
dotenv.config();

const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf
  }
}));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new Client(config);

app.post('/webhook', middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    const results = await Promise.all(events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'image') {
    return Promise.resolve(null);
  }

  const messageId = event.message.id;
  const stream = await client.getMessageContent(messageId);
  const path = `/tmp/${messageId}.jpg`;
  const writable = fs.createWriteStream(path);
  stream.pipe(writable);

  await new Promise(resolve => writable.on('finish', resolve));

  const goFileRes = await axios.post('https://api.gofile.io/uploadFile', {}, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: {
      file: fs.createReadStream(path)
    }
  });

  const imageUrl = goFileRes.data.data.downloadPage;
  const visionRes = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: [
        { type: 'text', text: 'この画像を説明してください。' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]}
    ]
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const replyText = visionRes.data.choices[0].message.content;

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
