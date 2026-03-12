import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import yts from "yt-search";

dotenv.config();

const app = express();
const PORT = 3000;
const db = new Database("islamic_content.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS whitelist (
    id TEXT PRIMARY KEY,
    channel_id TEXT UNIQUE,
    channel_title TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.json());

// Helper to map yt-search to YouTube API format
function mapToYTFormat(video: any) {
  if (!video) return null;
  
  return {
    id: { videoId: video.videoId || video.id || "" },
    snippet: {
      title: video.title || "Untitled Video",
      description: video.description || "",
      thumbnails: {
        medium: { url: video.thumbnail || video.image || "" },
        high: { url: video.thumbnail || video.image || "" }
      },
      channelTitle: video.author?.name || video.channelTitle || "Unknown Channel",
      channelId: video.author?.id || video.channelId || "",
      duration: video.duration?.timestamp || video.timestamp || ""
    }
  };
}

// API Routes
app.get("/api/videos", async (req, res, next) => {
  const { q } = req.query;

  // 1. Keyword-Based Filter
  const islamicKeywords = ["Quran", "Islam", "Hadith", "Sunnah", "Waz", "Islamic Lecture", "Nasheed", "Tafsir"];
  const searchQuery = `${q || ""} ${islamicKeywords.join(" OR ")}`.trim();

  try {
    console.log(`Searching videos for query: "${searchQuery}"`);
    
    // Use yt-search for more stability
    let results: any[] = [];
    try {
      const searchResult = await yts(searchQuery);
      results = searchResult.videos || [];
    } catch (searchError) {
      console.error("yt-search Error:", searchError);
      const searchResult = await yts(q ? String(q) : "Islamic");
      results = searchResult.videos || [];
    }

    if (!results || results.length === 0) {
      return res.json({ videos: [] });
    }

    // Map results and return (Validation moved to frontend as per guidelines)
    const mappedVideos = results.slice(0, 25).map(mapToYTFormat).filter(v => v !== null);
    res.json({ videos: mappedVideos });
  } catch (error) {
    next(error);
  }
});

app.get("/api/videos/related", async (req, res, next) => {
  const { q } = req.query;

  try {
    const searchQuery = q ? `${q} Islamic` : "Islamic Waz Quran";
    let results: any[] = [];
    try {
      const searchResult = await yts(searchQuery);
      results = searchResult.videos || [];
    } catch (searchError) {
      console.error("Related Search Error:", searchError);
      const searchResult = await yts("Islamic Waz");
      results = searchResult.videos || [];
    }
    
    res.json({ videos: (results || []).slice(0, 15).map(mapToYTFormat).filter(v => v !== null) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/whitelist", (req, res) => {
  const channels = db.prepare("SELECT * FROM whitelist").all();
  res.json(channels);
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Server Error:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: err.message || "Something went wrong on the server" 
  });
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static("dist"));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
