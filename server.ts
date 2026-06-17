import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { JWT } from "google-auth-library";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory / File Fallback Database paths
const DB_DIR = path.join(process.cwd(), "data");
const PROJECTS_FALLBACK_FILE = path.join(DB_DIR, "projects_fallback.json");
const SUBMISSIONS_FALLBACK_FILE = path.join(DB_DIR, "submissions_fallback.json");
const ALERTS_FALLBACK_FILE = path.join(DB_DIR, "alerts_fallback.json");

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Ensure default files exist if empty
if (!fs.existsSync(PROJECTS_FALLBACK_FILE)) {
  const defaultProjects = [
    {
      id: "assetscout-com",
      domain: "assetscout.com",
      name: "Asset Scout Corporate",
      code: "ASST",
      location: "Mumbai",
      region: "West",
      users: ["vatsal.assetscout@gmail.com", "vatsal", "John Doe"],
      description: "Asset Scout corporate real estate system"
    },
    {
      id: "cleandrive-net",
      domain: "cleandrive.net",
      name: "Clean Drive Automation",
      code: "CLDR",
      location: "Delhi",
      region: "North",
      users: ["developer@gmail.com", "developer", "Jane Smith"],
      description: "Clean Drive green technologies"
    },
    {
      id: "skyquest-org",
      domain: "skyquest.org",
      name: "Sky Quest Aero",
      code: "SKYQ",
      location: "Mumbai",
      region: "West",
      users: ["vatsal.assetscout@gmail.com", "developer@gmail.com", "vatsal", "developer"],
      description: "Aerospace operations"
    }
  ];
  fs.writeFileSync(PROJECTS_FALLBACK_FILE, JSON.stringify(defaultProjects, null, 2));
}

if (!fs.existsSync(SUBMISSIONS_FALLBACK_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FALLBACK_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(ALERTS_FALLBACK_FILE)) {
  fs.writeFileSync(ALERTS_FALLBACK_FILE, JSON.stringify([], null, 2));
}

function isValidSpreadsheetId(id?: string): boolean {
  if (!id) return false;
  const clean = id.trim();
  if (
    clean === "" ||
    clean.toLowerCase() === "your-google-spreadsheet-id" ||
    clean.toLowerCase().includes("your-google-spreadsheet") ||
    clean.toLowerCase().includes("placeholder") ||
    clean.toLowerCase().includes("spreadsheet") ||
    clean.toUpperCase().includes("MY_") ||
    clean.length < 20
  ) {
    return false;
  }
  return true;
}

function getProjectsSpreadsheetId(req?: express.Request): string | undefined {
  if (req) {
    const headerId = req.headers["x-projects-spreadsheet-id"] || req.headers["x-spreadsheet-id"];
    if (typeof headerId === "string" && headerId.trim() !== "") {
      return headerId.trim();
    }
  }
  return process.env.GOOGLE_PROJECTS_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
}

function getLogsSpreadsheetId(req?: express.Request): string | undefined {
  if (req) {
    const headerId = req.headers["x-logs-spreadsheet-id"] || req.headers["x-spreadsheet-id"];
    if (typeof headerId === "string" && headerId.trim() !== "") {
      return headerId.trim();
    }
  }
  return process.env.GOOGLE_LOGS_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
}

// Google Sheet Authentication check & helper
function getSheetsJWT() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    return null;
  }

  const emailClean = email.trim();
  const keyClean = privateKey.trim();

  if (
    emailClean === "" ||
    emailClean.toLowerCase().includes("your-service-account") ||
    emailClean.toLowerCase().includes("placeholder") ||
    !emailClean.includes("@") ||
    keyClean === "" ||
    keyClean.toLowerCase().includes("your-private-key") ||
    keyClean.toLowerCase().includes("placeholder") ||
    keyClean.includes("...") ||
    !keyClean.includes("-----BEGIN PRIVATE KEY-----")
  ) {
    return null;
  }

  try {
    return new JWT({
      email: emailClean,
      key: keyClean.replace(/\\n/g, '\n').trim(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } catch (err) {
    console.warn("Failed to initialize Google Sheets JWT (using local fallbacks):", err);
    return null;
  }
}

// Helper: Sheets values fetcher
async function fetchSheetValues(spreadsheetId: string, range: string) {
  const jwt = getSheetsJWT();
  if (!jwt) throw new Error("Sheets JWT not configured");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const headers = await jwt.getRequestHeaders(url);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    let errMsg = `Status ${res.status}`;
    try {
      const text = await res.text();
      try {
        const errJson = JSON.parse(text);
        if (errJson && errJson.error && errJson.error.message) {
          errMsg = errJson.error.message;
        } else {
          errMsg = text.slice(0, 150).replace(/\s+/g, ' ');
        }
      } catch {
        errMsg = text.slice(0, 150).replace(/\s+/g, ' ');
      }
    } catch {
      // Ignore text fetch issues
    }
    throw new Error(`Google Sheets fetch error (${res.status}): ${errMsg}`);
  }

  const data = await res.json();
  return data.values || [];
}

// Helper: Sheets append values
async function appendSheetValues(spreadsheetId: string, range: string, values: any[][]) {
  const jwt = getSheetsJWT();
  if (!jwt) throw new Error("Sheets JWT not configured");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const headers = await jwt.getRequestHeaders(url);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    let errMsg = `Status ${res.status}`;
    try {
      const text = await res.text();
      try {
        const errJson = JSON.parse(text);
        if (errJson && errJson.error && errJson.error.message) {
          errMsg = errJson.error.message;
        } else {
          errMsg = text.slice(0, 150).replace(/\s+/g, ' ');
        }
      } catch {
        errMsg = text.slice(0, 150).replace(/\s+/g, ' ');
      }
    } catch {
      // Ignore text fetch issues
    }
    throw new Error(`Google Sheets append failed (${res.status}): ${errMsg}`);
  }

  return await res.json();
}

// Helper: Seed headers if empty
async function ensureSheetHeaders(spreadsheetId: string, tabName: string, headers: string[]) {
  const jwt = getSheetsJWT();
  if (!jwt) return;

  try {
    const currentValues = await fetchSheetValues(spreadsheetId, `${tabName}!A1:A2`);
    if (currentValues && currentValues.length > 0) return; // already has content
  } catch (err) {
    // Tab might not exist, or is empty. Try to write headers
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName + '!A1')}?valueInputOption=USER_ENTERED`;
  const headersObj = await jwt.getRequestHeaders(url);

  await fetch(url, {
    method: 'PUT',
    headers: {
      ...headersObj,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [headers],
    }),
  });
}

// ==========================================
// API ROUTES
// ==========================================

// =========================================================================
// ACCESS CONTROL LISTS (Edit these lists directly here in the backend code)
// =========================================================================
const ALLOWED_ADMINS = [
  "vatsalpatel1720@gmail.com",

];

const ALLOWED_USERS = [
  "alex.rivera@company.com",
 "vatsal.assetscout@gmail.com",
];

// GET allowed list configurations for synchronization
app.get("/api/auth/config", (req, res) => {
  res.json({
    allowedAdmins: ALLOWED_ADMINS,
    allowedUsers: ALLOWED_USERS
  });
});

// POST user email session-login verification
app.post("/api/auth/verify", (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ allowed: false, error: "Email is required." });
  }

  const emailLower = email.trim().toLowerCase();
  const isAdmin = ALLOWED_ADMINS.some(adm => adm.toLowerCase() === emailLower);
  const isUser = ALLOWED_USERS.some(u => u.toLowerCase() === emailLower);

  if (isAdmin || isUser) {
    return res.json({
      allowed: true,
      role: isAdmin ? "admin" : "user",
      allowedAdmins: ALLOWED_ADMINS,
      allowedUsers: ALLOWED_USERS
    });
  }

  return res.status(403).json({
    allowed: false,
    error: `Access Denied: The email '${emailLower}' is not in the allowed user list. Please contact your system administrator to gain access.`
  });
});

// Config status checker for diagnostics and solving Googe Sheet 403 errors
app.get("/api/config-status", async (req, res) => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const projectsSpreadsheetId = getProjectsSpreadsheetId(req) || "";
  const logsSpreadsheetId = getLogsSpreadsheetId(req) || "";

  const status = {
    serviceAccountConfigured: !!(email && privateKey),
    serviceAccountEmail: email,
    projectsSpreadsheetId,
    logsSpreadsheetId,
    fetchStatus: { ok: false, error: "Not tested" },
    databaseStatus: { ok: false, error: "Not tested" }
  };

  const jwt = getSheetsJWT();
  if (!jwt) {
    status.fetchStatus.error = "Google Service Account credentials are not fully integrated. Please configure GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in your settings/environment.";
    status.databaseStatus.error = "Google Service Account credentials are not fully integrated.";
    return res.json(status);
  }

  // Test Fetch Spreadsheet (Projects/Domains list)
  if (isValidSpreadsheetId(projectsSpreadsheetId)) {
    try {
      const tabName = "Projects";
      await fetchSheetValues(projectsSpreadsheetId, `${tabName}!A1:B2`);
      status.fetchStatus = { ok: true, error: "" };
    } catch (e: any) {
      status.fetchStatus = { ok: false, error: e.message || String(e) };
    }
  } else {
    status.fetchStatus = { ok: false, error: "Projects spreadsheet ID is invalid / empty" };
  }

  // Test Database Spreadsheet (Logs list)
  if (isValidSpreadsheetId(logsSpreadsheetId)) {
    try {
      const tabName = "Logs";
      await fetchSheetValues(logsSpreadsheetId, `${tabName}!A1:B2`);
      status.databaseStatus = { ok: true, error: "" };
    } catch (e: any) {
      status.databaseStatus = { ok: false, error: e.message || String(e) };
    }
  } else {
    status.databaseStatus = { ok: false, error: "Logs spreadsheet ID is invalid / empty" };
  }

  return res.json(status);
});

// Get All Projects (Domains)
app.get("/api/projects", async (req, res) => {
  const spreadsheetId = getProjectsSpreadsheetId(req);
  const tabName = "Projects";
  const jwt = getSheetsJWT();

  if (!jwt || !isValidSpreadsheetId(spreadsheetId)) {
    console.log("No valid Google Sheets credential or Spreadsheet ID for fetching. Serving local fallback projects.");
    const fallbackProjects = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    return res.json(fallbackProjects);
  }

  try {
    // Fetch Column A to E (A: Project Name, B: Domain, C: Location, D: Region, E: Users)
    const range = `${tabName}!A1:E500`;
    const rows = await fetchSheetValues(spreadsheetId!, range);

    if (rows.length <= 1) {
      console.log("Projects sheet is empty. Seeding headers.");
      await ensureSheetHeaders(spreadsheetId!, tabName, ["Project Name", "Domain", "Location", "Region", "Users"]);
      return res.json([]);
    }

    const projectsMapped = rows.slice(1)
      .filter((row: any) => row[0] || row[1]) // must have a name or domain
      .map((row: any, index: number) => {
        const name = (row[0] || "").trim();
        const domain = (row[1] || "").trim() || name;
        const location = (row[2] || "").trim() || "Mumbai";
        const region = (row[3] || "").trim() || "West";
        const usersRaw = row[4] || "";
        
        const users = usersRaw.split(",")
          .map((u: string) => u.trim())
          .filter(Boolean);

        const projectCode = name.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "PRJ") || "PRJ";

        return {
          id: domain.toLowerCase().replace(/[^a-z0-9]/g, "-") || name.toLowerCase().replace(/[^a-z0-9]/g, "-") || `p-${index}`,
          domain,
          name,
          code: projectCode,
          location,
          region,
          users,
          description: `Assigned: ${usersRaw}`
        };
      });

    return res.json(projectsMapped);
  } catch (err: any) {
    console.info("[Sheets Info] Spreadsheet connection not ready; serving offline cached projects list.");
    const fallbackProjects = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    return res.json(fallbackProjects);
  }
});

// Get consolidated filter selections (projects, locations, regions, active team user emails)
app.get("/api/filters", async (req, res) => {
  const projectsSpreadsheetId = getProjectsSpreadsheetId(req);
  const logsSpreadsheetId = getLogsSpreadsheetId(req);
  const projectsTab = "Projects";
  const logsTab = "Logs";
  const jwt = getSheetsJWT();

  let projectsArr: any[] = [];
  const uniqueLocations = new Set<string>();
  const uniqueRegions = new Set<string>();
  const uniqueEmails = new Set<string>();

    // 1. Load Projects List
  if (jwt && isValidSpreadsheetId(projectsSpreadsheetId)) {
    try {
      const pRows = await fetchSheetValues(projectsSpreadsheetId!, `${projectsTab}!A1:E500`);
      if (pRows && pRows.length > 1) {
        pRows.slice(1)
          .filter((row: any) => row[0] || row[1])
          .forEach((row: any, index: number) => {
            const name = (row[0] || "").trim();
            const domain = (row[1] || "").trim() || name;
            const location = (row[2] || "").trim() || "Mumbai";
            const region = (row[3] || "").trim() || "West";
            const usersRaw = row[4] || "";
            const users = usersRaw.split(",").map((u: string) => u.trim()).filter(Boolean);
            const projectCode = name.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "PRJ") || "PRJ";

            projectsArr.push({
              id: domain.toLowerCase().replace(/[^a-z0-9]/g, "-") || name.toLowerCase().replace(/[^a-z0-9]/g, "-") || `p-${index}`,
              domain,
              name,
              code: projectCode,
              location,
              region,
              users,
              description: `Assigned: ${usersRaw}`
            });

            if (location) uniqueLocations.add(location);
            if (region) uniqueRegions.add(region);
            users.forEach(u => uniqueEmails.add(u.toLowerCase()));
          });
      }
    } catch (e) {
      console.info("[Sheets Info] Projects sheet connection not ready; serving filters via local offline list.");
    }
  }

  // Load fallback if sheets lookup failed or was empty
  if (projectsArr.length === 0) {
    try {
      const fallbackProjects = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
      projectsArr = fallbackProjects;
      fallbackProjects.forEach((p: any) => {
        if (p.location) uniqueLocations.add(p.location);
        if (p.region) uniqueRegions.add(p.region);
        if (p.users && Array.isArray(p.users)) {
          p.users.forEach((u: string) => uniqueEmails.add(u.toLowerCase()));
        }
      });
    } catch (e) {
      console.log("Fallback file projects read failed:", e);
    }
  }

  // 2. Fetch submissions to capture any user email who has reported on any project
  if (jwt && isValidSpreadsheetId(logsSpreadsheetId)) {
    try {
      const lRows = await fetchSheetValues(logsSpreadsheetId!, `${logsTab}!A1:E2500`);
      if (lRows && lRows.length > 1) {
        lRows.slice(1).forEach((row: any) => {
          if (row[2]) {
            uniqueEmails.add(row[2].trim().toLowerCase());
          }
        });
      }
    } catch (e) {
      console.info("[Sheets Info] Logs sheet connection not ready; serving filters via local offline list.");
    }
  } else {
    try {
      const fallbackSubmissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
      fallbackSubmissions.forEach((entry: any) => {
        if (entry.userEmail) {
          uniqueEmails.add(entry.userEmail.trim().toLowerCase());
        }
      });
    } catch (e) {
      console.log("Fallback submissions read failed:", e);
    }
  }

  // Enforce standard fallback lists if empty
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
});

// Update/Modify project allocation (for Admin edits)
app.post("/api/projects", (req, res) => {
  const { action, project } = req.body;
  
  try {
    const list = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    if (action === "add" && project) {
      project.id = project.domain.toLowerCase().replace(/[^a-z0-9]/g, "-") || `p-${Date.now()}`;
      list.push(project);
    } else if (action === "edit" && project) {
      const idx = list.findIndex((p: any) => p.id === project.id);
      if (idx !== -1) {
        list[idx] = project;
      }
    } else if (action === "delete" && project) {
      const filtered = list.filter((p: any) => p.id !== project.id);
      fs.writeFileSync(PROJECTS_FALLBACK_FILE, JSON.stringify(filtered, null, 2));
      return res.json({ success: true });
    }
    fs.writeFileSync(PROJECTS_FALLBACK_FILE, JSON.stringify(list, null, 2));
    return res.json({ success: true, list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Submissions (grouped DSR Submissions Logs)
app.get("/api/submissions", async (req, res) => {
  const spreadsheetId = getLogsSpreadsheetId(req);
  const tabName = "Logs";
  const jwt = getSheetsJWT();

  if (!jwt || !isValidSpreadsheetId(spreadsheetId)) {
    const fallbackSubmissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
    return res.json(fallbackSubmissions);
  }

  try {
    const range = `${tabName}!A1:S2500`;
    const rows = await fetchSheetValues(spreadsheetId!, range);

    if (rows.length <= 1) {
      return res.json([]);
    }

    const groupedEntries: Record<string, any> = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0] || !row[1] || !row[2]) continue;

      const subBlockId = row[0];
      const dsrParentId = subBlockId.split('-').slice(0, 2).join('-');
      const date = row[1];
      const userEmail = row[2];
      const projectId = row[3] || '';
      const projectName = row[4] || '';
      const listingCount = parseInt(row[5], 10) || 0;
      const blogCount = parseInt(row[6], 10) || 0;
      const pdfCount = parseInt(row[7], 10) || 0;
      const imageCount = parseInt(row[8], 10) || 0;
      const blogNarrative = row[9] || '';
      
      let customValues = {};
      try {
        if (row[10] && row[10].trim().startsWith('{')) {
          customValues = JSON.parse(row[10]);
        }
      } catch (e) {
        // ignore JSON errors
      }

      const createdAt = row[11] || new Date().toISOString();
      const workTypes = row[12] ? row[12].split(',').map((s: any) => s.trim()).filter(Boolean) : [];
      const contentUpdates = row[13] ? row[13].split(',').map((s: any) => s.trim()).filter(Boolean) : [];
      const workSummary = row[14] || '';
      const forumCount = parseInt(row[15], 10) || 0;
      const videoPptCount = parseInt(row[16], 10) || 0;
      const profileCount = parseInt(row[17], 10) || 0;
      const linkCount = parseInt(row[18], 10) || 0;

      const workItem = {
        id: subBlockId,
        projectId,
        projectName,
        listingCount,
        blogCount,
        forumCount,
        pdfCount,
        imageCount,
        videoPptCount,
        profileCount,
        linkCount,
        blog: blogNarrative,
        customValues,
        workTypes,
        contentUpdates,
        workSummary
      };

      if (!groupedEntries[dsrParentId]) {
        groupedEntries[dsrParentId] = {
          id: dsrParentId,
          date,
          userEmail,
          works: [],
          createdAt,
        };
      }
      groupedEntries[dsrParentId].works.push(workItem);
    }

    const list = Object.values(groupedEntries).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
    return res.json(list);
  } catch (err: any) {
    console.info("[Sheets Info] Spreadsheet connection not ready; fetching offline cached submissions.");
    const fallbackSubmissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
    return res.json(fallbackSubmissions);
  }
});

// Clear logs/submissions (Disabled per user requirement)
app.delete("/api/submissions", (req, res) => {
  return res.status(403).json({ error: "Logs cannot be deleted from history." });
});

// Append Submissions (Log DSR submission to Google Sheet)
app.post("/api/submissions/append", async (req, res) => {
  const { works, date, userEmail } = req.body;
  if (!userEmail || !works || !Array.isArray(works)) {
    return res.status(400).json({ error: "Missing required submission body fields" });
  }

  const spreadsheetId = getLogsSpreadsheetId(req);
  const tabName = "Logs";
  const jwt = getSheetsJWT();

  const submissionId = `dsr-${Date.now()}`;
  const createdAt = new Date().toISOString();

  // Save locally first to the fallback file
  try {
    const list = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
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
  } catch (e: any) {
    console.error("Failed writing locally:", e);
  }

  // Upload to google sheet if possible
  if (jwt && isValidSpreadsheetId(spreadsheetId)) {
    try {
      // 19 standard columns schema
      const headers = [
        'DSR ID',
        'Reporting Date',
        'User Email',
        'Project ID',
        'Project Name',
        'Listing Count',
        'Blog Count',
        'PDF Count',
        'Image Count',
        'Work Narrative',
        'Custom Values JSON',
        'CreatedAt',
        'Work Types',
        'Content Updates',
        'Work Summary',
        'Forum Count',
        'Video PPT Count',
        'Profile Count',
        'Link Count'
      ];

      await ensureSheetHeaders(spreadsheetId, tabName, headers);

      const rowsToWrite = works.map((work: any, index: number) => {
        const blockId = `${submissionId}-${index}`;
        return [
          blockId,
          date,
          userEmail,
          work.projectId || '',
          work.projectName || '',
          (work.listingCount ?? 0).toString(),
          (work.blogCount ?? 0).toString(),
          (work.pdfCount ?? 0).toString(),
          (work.imageCount ?? 0).toString(),
          work.blog || '',
          JSON.stringify(work.customValues || {}),
          createdAt,
          (work.workTypes || []).join(', '),
          (work.contentUpdates || []).join(', '),
          work.workSummary || '',
          (work.forumCount ?? 0).toString(),
          (work.videoPptCount ?? 0).toString(),
          (work.profileCount ?? 0).toString(),
          (work.linkCount ?? 0).toString()
        ];
      });

      await appendSheetValues(spreadsheetId, `${tabName}!A1:S1`, rowsToWrite);
      return res.json({ success: true, source: "Google Sheets" });
    } catch (err: any) {
      console.info("[Sheets Info] Spreadsheet connection not ready; writing record to offline storage.");
      return res.json({ success: true, source: "In-Memory Fallback Local DB (Offline mode)" });
    }
  }

  return res.json({ success: true, source: "In-Memory Fallback Local DB (Google Service Account Credentials not configured)" });
});

// GET Alerts
app.get("/api/alerts", (req, res) => {
  try {
    const list = JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Alerts (Add Alerts / Notes to admin)
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

// POST Dismiss/Clear Alert(s)
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
// VITE DEV SERVER OR STATIC SERVING IN PRODUCTION
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
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
