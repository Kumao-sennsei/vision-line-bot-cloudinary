require('dotenv').config();
const express = require('express');
const { Configuration, OpenAIApi } = require('openai');
const line = require('@line/bot-sdk');
const rawBodyParser = require('raw-body');
const uploadImageToCloudinary = require('./uploadImageToCloudinary.js');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.post('/webhook', line.middleware(config), async (req, res) => {
  const body = await rawBodyParser(req);
  const signature = req.headers['x-line-signature'];

  if (!line.validateSignature(body, config.channelSecret, signature)) {
    return res.status(401).send('Unauthorized');
  }

  Promise.all(req.body.events.map(handleEvent)).then(result => res.json(result));
});

async function handleEvent(event) {
  if (event.type !== 'message') return;

  if (event.message.type === 'image') {
    try {
      const imageBuffer = await client.getMessageContent(event.message.id);
      const chunks = [];
      for await (const chunk of imageBuffer) chunks.push(chunk);
      const imageData = Buffer.concat(chunks).toString('base64');

      const imageUrl = await uploadImageToCloudinary(imageData);

      const response = await openai.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: '画像を見て優しく丁寧に解説する先生になってください。' },
          { role: 'user', content: [{ type: 'image_url', image_url: { url: imageUrl } }] },
        ],
      });

      const replyText = response.data.choices[0].message.content;
      await client.replyMessage(event.replyToken, { type: 'text', text: replyText });
    } catch (error) {
      console.error('画像処理エラー:', error);
      await client.replyMessage(event.replyToken, { type: 'text', text: '画像の処理中にエラーが発生しました。' });
    }
  } else {
    await client.replyMessage(event.replyToken, { type: 'text', text: '画像を送ってくださいね！' });
  }
}

app.listen(8080, () => {
  console.log('Server is running on port 8080');
});