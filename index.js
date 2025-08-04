const express = require("express");
const line = require("@line/bot-sdk");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const uploadImageToCloudinary = require("./uploadImageToCloudinary");
const axios = require("axios");

dotenv.config();
const app = express();

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;
  const results = await Promise.all(events.map(handleEvent));
  res.json(results);
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "image") {
    return Promise.resolve(null);
  }

  const stream = await client.getMessageContent(event.message.id);
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  const imageBuffer = Buffer.concat(chunks);
  const base64Image = imageBuffer.toString("base64");

  try {
    const imageUrl = await uploadImageToCloudinary(base64Image);
    const visionRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "画像を丁寧に解説してください。くまお先生風にお願いします。",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const replyText = `📖くまお先生の解説：
${visionRes.data.choices[0].message.content}`;

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: replyText,
    });
  } catch (err) {
    console.error("Error:", err);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "画像の処理中にエラーが発生しました。",
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});