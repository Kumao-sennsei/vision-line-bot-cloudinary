app.post('/webhook', middleware(config), async (req, res) => {
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
