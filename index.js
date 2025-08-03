require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const uploadToCloudinary = require('./uploadImageToCloudinary');

const app = express();
app.use(express.json({ limit: "10mb" }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(async (event) => {
      if (event.type === 'message' && event.message.type === 'image') {
        const stream = await client.getMessageContent(event.message.id);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        const dataUri = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        const imageUrl = await uploadToCloudinary(dataUri);

        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `アップロード成功！URL:
${imageUrl}`,
        });
      }
    }));
    res.status(200).end();
  } catch (err) {
    console.error('Error:', err);
    res.status(500).end();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));