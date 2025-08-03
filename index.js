const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const dotenv = require('dotenv');
const app = express();
dotenv.config();

app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf } }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  if (!Array.isArray(events)) {
    return res.status(500).end();
  }

  const results = await Promise.all(events.map(async (event) => {
    if (event.type !== 'message' || event.message.type !== 'image') {
      return Promise.resolve(null);
    }

    try {
      const stream = await client.getMessageContent(event.message.id);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const base64Image = buffer.toString('base64');
      const contentType = stream.headers['content-type'] || 'image/jpeg';

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'この画像を見て分かることを教えてください。' },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${contentType};base64,${base64Image}`
                  }
                }
              ]
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const replyText = response.data.choices[0].message.content;
      return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
    } catch (error) {
      console.error('Error:', error);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '画像の処理中にエラーが発生しました…(´・ω・｀)'
      });
    }
  }));

  res.status(200).end();
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
