const express = require("express");
const cors = require("cors");
const { EdgeTTS } = require("node-edge-tts");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;

// Permitir peticiones desde Netlify, el APK y cualquier navegador
app.use(cors({ origin: "*" }));
app.use(express.json());

// Carpeta temporal para guardar audios en caché y responder en 50 milisegundos
const cacheDir = path.join(os.tmpdir(), "bingo_voice_cache");
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Ruta de comprobación de salud
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Servidor de Voz Gonzalo y Salomé para Bingo Digital",
    example: "/api/voice?text=Felicitaciones+a+Carlos+Mendoza&voice=gonzalo"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Ruta principal de síntesis de voz (compatible con GET y POST)
app.all("/api/voice", async (req, res) => {
  try {
    const text = String(req.query.text || req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ error: "Falta el parámetro 'text'" });
    }

    const voiceParam = String(req.query.voice || req.body?.voice || "").toLowerCase();
    const voice = voiceParam.includes("salome") ? "es-CO-SalomeNeural" : "es-CO-GonzaloNeural";
    const rate = String(req.query.rate || "-4%");
    const volume = String(req.query.volume || "+100%");

    // Buscar en caché para respuesta instantánea
    const hash = crypto.createHash("md5").update(`${text}_${voice}_${rate}_${volume}`).digest("hex");
    const cachedFile = path.join(cacheDir, `${hash}.mp3`);

    if (fs.existsSync(cachedFile)) {
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return fs.createReadStream(cachedFile).pipe(res);
    }

    // Generar voz con Microsoft Edge Neural TTS
    const tts = new EdgeTTS({ voice, rate, volume });
    await tts.ttsPromise(text, cachedFile);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");
    fs.createReadStream(cachedFile).pipe(res);
  } catch (err) {
    console.error("Error en generación de voz:", err);
    res.status(500).json({ error: "No se pudo generar el audio neural" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor de voz de Gonzalo y Salomé escuchando en puerto ${PORT}`);
});
