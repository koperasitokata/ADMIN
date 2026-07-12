import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

const app = express();

// Load environment variables manually from .env or .env.example if not provided by host
const envFiles = [".env", ".env.example"];
for (const file of envFiles) {
  const envPath = path.join(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const firstEqual = trimmed.indexOf("=");
          if (firstEqual > 0) {
            const key = trimmed.substring(0, firstEqual).trim();
            const val = trimmed.substring(firstEqual + 1).trim().replace(/^['"]|['"]$/g, "");
            if (key && !process.env[key]) {
              process.env[key] = val;
              console.log(`[Config] Loaded Env from ${file}: ${key} = ${val}`);
            }
          }
        }
      });
    } catch (e) {
      console.warn(`Warning loading ${file}:`, e);
    }
  }
}

// Rekursif mengubah URL foto PHP (GET_PHOTO) menjadi url relatif /api/photo
function rewritePhotoUrls(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.includes('action=GET_PHOTO')) {
      const queryIdx = obj.indexOf('?');
      if (queryIdx >= 0) {
        return `/api/photo${obj.substring(queryIdx)}`;
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(rewritePhotoUrls);
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = rewritePhotoUrls(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

app.use(cors());
app.use(express.json({ limit: '50mb', type: ['application/json', 'text/plain'] }));

// Catch-all GET
app.get("*", async (req, res) => {
  const urlPath = req.path || req.url || "";
  
  // 1. Check for Photo Request
  if (urlPath.includes("photo")) {
    const remoteUrl = process.env.VITE_API_URL || process.env.API_URL || "https://backend.tokata.site/v1/admin";
    if (!remoteUrl || !remoteUrl.startsWith('http')) {
      return res.status(404).send("No remote api configured");
    }

    const queryParams = new URLSearchParams(req.query as any);
    if (!queryParams.has('action')) {
      queryParams.set('action', 'GET_PHOTO');
    }

    const targetUrl = `${remoteUrl}?${queryParams.toString()}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      let contentType = response.headers.get('content-type') || 'image/jpeg';
      if (contentType === 'image' || !contentType.includes('/')) {
        contentType = 'image/jpeg';
      }
      
      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error("[Proxy Photo GET Error]:", err.message);
      res.setHeader('Content-Type', 'image/gif');
      return res.send(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
    }
  }

  // 2. Otherwise treatment as Health Check
  return res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(), 
    env: "vercel-serverless",
    path_received: urlPath,
    proxy_active: !!(process.env.VITE_API_URL || process.env.API_URL)
  });
});

// Catch-all POST
app.post("*", async (req, res) => {
  console.log(`[Vercel Serverless] Received POST on path: ${req.path || req.url}. Action: ${req.body?.action}`);
  
  const remoteUrl = process.env.VITE_API_URL || process.env.API_URL || "https://backend.tokata.site/v1/admin";
  
  if (remoteUrl && remoteUrl.startsWith('http')) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 Sec timeout limit

    try {
      const bodyStr = JSON.stringify(req.body);
      const payloadSize = bodyStr.length;
      
      console.log(`[Proxy] Forwarding ${req.body?.action} to DB php/script: ${remoteUrl}. Payload: ${(payloadSize / 1024).toFixed(2)} KB`);
      
      const response = await fetch(remoteUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'text/plain;charset=utf-8',
          'Accept': 'application/json'
        },
        body: bodyStr,
        redirect: 'follow',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const text = await response.text();
      
      try {
        const data = JSON.parse(text);
        console.log(`[Proxy Success] ${req.body?.action} response received`);
        return res.json(rewritePhotoUrls(data));
      } catch (parseError) {
        console.error(`[Proxy Error] Non-JSON response for ${req.body?.action}:`, text.substring(0, 1000));
        
        let errorMsg = "Umpan balik server database bukan format JSON yang valid.";
        if (text.includes("522") || text.includes("Connection timed out")) {
          errorMsg = "Cloudflare Error 522: Koneksi ke server VPS asal Anda Timeout. Pastikan server web PHP/MySQL Anda aktif.";
        } else if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          errorMsg = "Server database Anda mengembalikan halaman HTML. Kemungkinan terjadi error internal PHP atau database mati.";
        }

        return res.json({ 
          success: false, 
          message: errorMsg,
          details: text.substring(0, 100) 
        });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`[Proxy Network Error] ${req.body?.action}:`, error.message);
      if (error.name === 'AbortError') {
        return res.json({ 
          success: false, 
          message: `Koneksi Timeout. Server database Anda di ${remoteUrl} tidak merespons. Pastikan server VPS Anda aktif.` 
        });
      }
      return res.json({ success: false, message: "Gagal menghubungi server database Anda: " + error.message });
    }
  }

  // Fallback if no remote URL is configured
  return res.json({ 
    success: false, 
    message: "Server URL belum dikonfigurasi. Harap tentukan VITE_API_URL di Environment Variables Vercel." 
  });
});

export default app;
