export default async function handler(req, res) {
  try {
    console.log("✅ Webhook hit");
    res.status(200).json({ message: "Webhook is working!" });
  } catch (err) {
    console.error("❌ Error in fallback test:", err);
    res.status(500).json({ error: "Something broke" });
  }
}
