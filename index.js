const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

app.post('/webhook', line.middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error('Webhook error:', err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'image') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '画像を送ってください！'
    });
  }

  try {
    const stream = await client.getMessageContent(event.message.id);
    const filePath = `/tmp/${event.message.id}.jpg`;
    const writable = fs.createWriteStream(filePath);
    stream.pipe(writable);
    await new Promise(resolve => writable.on('finish', resolve));

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const gofileRes = await axios.post('https://api.gofile.io/uploadFile', form, {
      headers: form.getHeaders()
    });

    const imageUrl = gofileRes.data.data.downloadPage;

    const visionRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '送られた画像を分析して、日本語でやさしく丁寧に解説してください。'
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      max_tokens: 1000
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

  } catch (err) {
    console.error('Error handling image:', err);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '画像の処理中にエラーが発生しました。'
    });
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on ${port}`);
});
