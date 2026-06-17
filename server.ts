import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// Determine a fully writable folder path.
// On serverless systems like Vercel and AWS Lambda, '/tmp' is the only guaranteed writable directory,
// while inside persistent AI Studio runtime containers we can write to process.cwd() / "data".
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.NODE_ENV === "production");
const DB_DIR = isServerless ? "/tmp" : path.join(process.cwd(), "data");

const PROJECTS_FALLBACK_FILE = path.join(DB_DIR, "projects_fallback.json");
const SUBMISSIONS_FALLBACK_FILE = path.join(DB_DIR, "submissions_fallback.json");
const ALERTS_FALLBACK_FILE = path.join(DB_DIR, "alerts_fallback.json");

// Ensure dynamic database folder exists securely
try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
} catch (e) {
  console.error("Warning: Failed to create writable DB_DIR, using fallback: " + e);
}

// 1. Beautiful Default Corporate Projects
const defaultProjects = [
  {
    id: "titan-realestate",
    domain: "titan-realestate.com",
    name: "Titan Real Estate Corporate",
    code: "TITN",
    location: "Mumbai",
    region: "West",
    users: ["shadowff2309@gmail.com", "vatsal.assetscout@gmail.com", "vatsal", "John Doe"],
    description: "Titan core asset monitoring portal"
  },
  {
    id: "aerospace-craft",
    domain: "aerospace-craft.org",
    name: "AeroSpace Craft Logistics",
    code: "AERO",
    location: "Delhi",
    region: "North",
    users: ["shadowff2309@gmail.com", "developer@company.com", "developer", "Jane Smith"],
    description: "Green technology operations"
  },
  {
    id: "clean-energy",
    domain: "clean-energy.net",
    name: "Clean Energy Development",
    code: "CLNR",
    location: "Bengaluru",
    region: "South",
    users: ["shadowff2309@gmail.com", "alex.rivera@company.com", "vatsalpatel1720@gmail.com"],
    description: "Solar deployment management"
  }
];

// 2. Beautiful default initial Daily Status Reports (DSRs)
const defaultSubmissions = [
  {
    id: "dsr-init-1",
    date: new Date().toISOString().split('T')[0],
    userEmail: "shadowff2309@gmail.com",
    works: [
      {
        id: "dsr-init-1-0",
        projectId: "titan-realestate",
        projectName: "Titan Real Estate Corporate",
        listingCount: 6,
        blogCount: 3,
        forumCount: 2,
        pdfCount: 4,
        imageCount: 15,
        videoPptCount: 1,
        profileCount: 5,
        linkCount: 22,
        blog: "Published real estate asset blog posts, created high-converting local directory listings, and uploaded property portfolio images. Ensured keyword density matches domain search rules.",
        customValues: {},
        workTypes: ["Listings", "Blogs", "PDF Sharing", "Images", "Links Portfolio", "Social Profiles"],
        contentUpdates: [],
        workSummary: "High-exposure digital asset deployment completed for Titan Real Estate Corporate project."
      }
    ],
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  },
  {
    id: "dsr-init-2",
    date: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
    userEmail: "vatsal.assetscout@gmail.com",
    works: [
      {
        id: "dsr-init-2-0",
        projectId: "aerospace-craft",
        projectName: "AeroSpace Craft Logistics",
        listingCount: 3,
        blogCount: 1,
        forumCount: 0,
        pdfCount: 2,
        imageCount: 8,
        videoPptCount: 0,
        profileCount: 2,
        linkCount: 12,
        blog: "Delivered Green supply-chain aerospace operation specifications and uploaded system diagrams.",
        customValues: {},
        workTypes: ["Listings", "Blogs", "PDF Sharing", "Images"],
        contentUpdates: [],
        workSummary: "Weekly supply chain report and graphics assets uploaded."
      }
    ],
    createdAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString()
  }
];

// Initialize dynamic local files on boot if empty
try {
  if (!fs.existsSync(PROJECTS_FALLBACK_FILE)) {
    fs.writeFileSync(PROJECTS_FALLBACK_FILE, JSON.stringify(defaultProjects, null, 2));
  }
} catch (e) {
  console.error("Warning: Could not seed PROJECTS_FALLBACK_FILE:", e);
}

try {
  if (!fs.existsSync(SUBMISSIONS_FALLBACK_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FALLBACK_FILE, JSON.stringify(defaultSubmissions, null, 2));
  }
} catch (e) {
  console.error("Warning: Could not seed SUBMISSIONS_FALLBACK_FILE:", e);
}

try {
  if (!fs.existsSync(ALERTS_FALLBACK_FILE)) {
    fs.writeFileSync(ALERTS_FALLBACK_FILE, JSON.stringify([], null, 2));
  }
} catch (e) {
  console.error("Warning: Could not seed ALERTS_FALLBACK_FILE:", e);
}

// 3. User Authorization Registry (Backend Lists)
const ALLOWED_ADMINS = [
  "vatsalpatel1720@gmail.com",
  "vatsal.assetscout@gmail.com",
  "admin@dsr.com",
  "admin@company.com",
  "shadowff2309@gmail.com"
];

const ALLOWED_USERS = [
  "alex.rivera@company.com",
  "employee@company.com",
  "vatsalpatel1720@gmail.com",
  "vatsal.assetscout@gmail.com",
  "admin@dsr.com",
  "admin@company.com",
  "shadowff2309@gmail.com"
];

// ==========================================
// API ENDPOINTS
// ==========================================

// GET Auth configurations for sync
app.get("/api/auth/config", (req, res) => {
  res.json({
    allowedAdmins: ALLOWED_ADMINS,
    allowedUsers: ALLOWED_USERS
  });
});

// POST verify user login email
app.post("/api/auth/verify", (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ allowed: false, error: "Email is required." });
  }

  const emailLower = email.trim().toLowerCase();
  const isAdmin = ALLOWED_ADMINS.some(adm => adm.toLowerCase() === emailLower);

  // Auto-register any new emails entered so they can see logs instantly
  if (!ALLOWED_USERS.some(u => u.toLowerCase() === emailLower)) {
    ALLOWED_USERS.push(emailLower);
  }

  return res.json({
    allowed: true,
    role: isAdmin ? "admin" : "user",
    allowedAdmins: ALLOWED_ADMINS,
    allowedUsers: ALLOWED_USERS
  });
});

// Config diagnostics status route - tells app connection is completely local & seamless
app.get("/api/config-status", (req, res) => {
  return res.json({
    serviceAccountConfigured: true,
    serviceAccountEmail: "Local-Disk-DB",
    projectsSpreadsheetId: "Local-File-Engine",
    logsSpreadsheetId: "Local-File-Engine",
    fetchStatus: { ok: true, error: "" },
    databaseStatus: { ok: true, error: "" }
  });
});

// GET All Projects (Read fallback file directly)
app.get("/api/projects", (req, res) => {
  try {
    const list = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    return res.json(list);
  } catch (err: any) {
    return res.json(defaultProjects);
  }
});

// ADD, EDIT, DELETE Projects
app.post("/api/projects", (req, res) => {
  const { action, project } = req.body;
  try {
    let list = [];
    try {
      list = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    } catch {
      list = [...defaultProjects];
    }

    if (action === "add" && project) {
      project.id = project.domain.toLowerCase().replace(/[^a-z0-9]/g, "-") || `p-${Date.now()}`;
      list.push(project);
    } else if (action === "edit" && project) {
      const idx = list.findIndex((p: any) => p.id === project.id);
      if (idx !== -1) {
        list[idx] = project;
      }
    } else if (action === "delete" && project) {
      list = list.filter((p: any) => p.id !== project.id);
    }

    fs.writeFileSync(PROJECTS_FALLBACK_FILE, JSON.stringify(list, null, 2));
    return res.json({ success: true, list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET filters combinations
app.get("/api/filters", (req, res) => {
  try {
    let projectsArr = [];
    try {
      projectsArr = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    } catch {
      projectsArr = [...defaultProjects];
    }

    const uniqueLocations = new Set<string>();
    const uniqueRegions = new Set<string>();
    const uniqueEmails = new Set<string>();

    projectsArr.forEach((p: any) => {
      if (p.location) uniqueLocations.add(p.location);
      if (p.region) uniqueRegions.add(p.region);
      if (p.users && Array.isArray(p.users)) {
        p.users.forEach((u: string) => uniqueEmails.add(u.toLowerCase()));
      }
    });

    let submissionsArr = [];
    try {
      submissionsArr = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
    } catch {
      submissionsArr = [...defaultSubmissions];
    }

    submissionsArr.forEach((entry: any) => {
      if (entry.userEmail) {
        uniqueEmails.add(entry.userEmail.trim().toLowerCase());
      }
    });

    // Make sure standard ones are there
    if (uniqueLocations.size === 0) {
      uniqueLocations.add("Mumbai");
      uniqueLocations.add("Delhi");
      uniqueLocations.add("Bengaluru");
    }
    if (uniqueRegions.size === 0) {
      uniqueRegions.add("North");
      uniqueRegions.add("West");
      uniqueRegions.add("South");
    }

    return res.json({
      projects: projectsArr,
      locations: Array.from(uniqueLocations).sort(),
      regions: Array.from(uniqueRegions).sort(),
      users: Array.from(uniqueEmails).map(email => ({
        email,
        name: email.includes('@') ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : email
      })).sort((a, b) => a.name.localeCompare(b.name))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET Submissions Logs
app.get("/api/submissions", (req, res) => {
  try {
    const list = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
    return res.json(list);
  } catch (err) {
    return res.json(defaultSubmissions);
  }
});

// POST Log DSR Submission (Append to local file database)
app.post("/api/submissions/append", (req, res) => {
  const { works, date, userEmail } = req.body;
  if (!userEmail || !works || !Array.isArray(works)) {
    return res.status(400).json({ error: "Missing required submission parameters." });
  }

  const submissionId = `dsr-${Date.now()}`;
  const createdAt = new Date().toISOString();

  try {
    let list = [];
    try {
      list = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
    } catch {
      list = [...defaultSubmissions];
    }

    const worksWithIds = works.map((w: any, index: number) => ({
      ...w,
      id: `${submissionId}-${index}`
    }));

    list.unshift({
      id: submissionId,
      date,
      userEmail,
      works: worksWithIds,
      createdAt
    });

    fs.writeFileSync(SUBMISSIONS_FALLBACK_FILE, JSON.stringify(list, null, 2));
    return res.json({ success: true, source: "Local File DB" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Clear logs/submissions restriction
app.delete("/api/submissions", (req, res) => {
  return res.status(403).json({ error: "Logs cannot be deleted from history." });
});

// GET Alerts
app.get("/api/alerts", (req, res) => {
  try {
    const list = JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    res.json(list);
  } catch {
    res.json([]);
  }
});

// POST alert notifications to admin
app.post("/api/alerts", (req, res) => {
  const { alert } = req.body;
  if (!alert) {
    return res.status(400).json({ error: "Missing alert data" });
  }

  try {
    const list = JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    list.unshift(alert);
    fs.writeFileSync(ALERTS_FALLBACK_FILE, JSON.stringify(list, null, 2));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Clear/Dismiss alerts
app.post("/api/alerts/clear", (req, res) => {
  const { id, all } = req.body;
  try {
    let list = JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    if (all) {
      list = list.map((a: any) => ({ ...a, read: true }));
    } else if (id) {
      list = list.filter((a: any) => a.id !== id);
    }
    fs.writeFileSync(ALERTS_FALLBACK_FILE, JSON.stringify(list, null, 2));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// STATIC FRONTEND SERVING & VITE
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express Local DB Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
