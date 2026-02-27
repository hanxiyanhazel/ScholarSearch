import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import JSZip from "jszip";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Proxy search to Semantic Scholar
  app.get("/api/search/semantic-scholar", async (req, res) => {
    try {
      const { query, limit = 50, offset = 0 } = req.query;
      const response = await axios.get(`https://api.semanticscholar.org/graph/v1/paper/search`, {
        params: {
          query,
          limit,
          offset,
          fields: "title,authors,year,venue,externalIds,abstract,openAccessPdf,citationCount,publicationTypes",
        },
        headers: {
          // 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY // Optional
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Semantic Scholar Search Error:", error.message);
      res.status(500).json({ error: "Failed to search Semantic Scholar" });
    }
  });

  // API: Batch Download and Zip
  app.post("/api/download-zip", async (req, res) => {
    try {
      const { papers } = req.body; // Array of { title, pdfUrl }
      const zip = new JSZip();

      const downloadPromises = papers.map(async (paper: any) => {
        try {
          const response = await axios.get(paper.pdfUrl, { responseType: "arraybuffer" });
          const fileName = `${paper.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
          zip.file(fileName, response.data);
          return { success: true, title: paper.title };
        } catch (err) {
          console.error(`Failed to download ${paper.title}:`, err);
          return { success: false, title: paper.title };
        }
      });

      const results = await Promise.all(downloadPromises);
      const content = await zip.generateAsync({ type: "nodebuffer" });

      res.set("Content-Type", "application/zip");
      res.set("Content-Disposition", "attachment; filename=papers.zip");
      res.send(content);
    } catch (error: any) {
      console.error("Zip Error:", error.message);
      res.status(500).json({ error: "Failed to create zip" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
