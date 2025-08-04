require("dotenv").config();
const express = require("express");
const { middleware, Client } = require("@line/bot-sdk");

const app = express();
app.use(express.json({ limit: "10mb" }));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(config);

// Webhookエンドポイント
app.post("/webhook", middleware(config), async (req, res) => {
  console.log("📩 Webhook受信しました！");

  const events = req.body.events;
  if (!Array.isArray(events)) {
    console.log("⚠️ eventsが配列じゃないです！");
    return res.status(500).end();
  }

  const results = await Promise.all(
    events.map((event) => {
      console.log("👀 Eventタイプ：", event.type);

      if (event.message && event.message.type === "image") {
        console.log("📷 画像が届きました！");
      } else if (event.message && event.message.type === "text") {
        console.log("💬 テキストが届きました：", event.message.text);
      } else {
        console.log("🤷‍♂️ 未対応イベントタイプ：", event.message?.type);
      }

      return handleEvent(event);
    })
  );

  res.json(results);
});

// ハンドラー関数（仮）
async function handleEvent(event) {
  if (event.type !== "message") {
    return Promise.resolve(null);
  }

  // 仮返信（テキスト）
  if (event.message.type === "text") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `くまお先生が受け取りました🐻：「${event.message.text}」`,
    });
  }

  // 仮返信（画像）
  if (event.message.type === "image") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "画像を受け取りました！ただいま分析中です📷✨",
    });
  }

  return Promise.resolve(null);
}

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 サーバー起動中 on port ${PORT}`);
});
