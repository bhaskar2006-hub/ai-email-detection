const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/emailDB")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";

/* ─── Email Schema ─────────────────────────────────────────────────────────── */
const EmailSchema = new mongoose.Schema(
  {
    subject:            { type: String, default: "" },
    sender:             { type: String, default: "" },
    email:              String,
    category:           String,
    urgency:            String,
    team:               String,
    summary:            String,
    sentiment:          String,
    intent:             { type: String, default: "" },
    recommended_member: { type: String, default: "" },
    assigned_to:        { type: String, default: "" },
    suggested_reply:    String,
    confidence_score:   { type: Number, default: 0.7 },
    reasoning:          { type: String, default: "" },
    sla_due:            Date,
    status:             { type: String, default: "new", enum: ["new", "assigned", "in_progress", "escalated", "resolved", "snoozed", "pending"] },
    read:               { type: Boolean, default: false },
    tags:               { type: [String], default: [] },
  },
  { timestamps: true }
);

const Email = mongoose.model("Email", EmailSchema);

/* ─── Team Member Schema ───────────────────────────────────────────────────── */
const TeamMemberSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true },
    email:          { type: String, default: "" },
    role:           { type: String, default: "Support Agent" },
    department:     { type: String, default: "Support" },
    skills:         { type: [String], default: [] },
    availability:   { type: String, default: "available", enum: ["available", "busy", "offline"] },
    currentTickets: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const TeamMember = mongoose.model("TeamMember", TeamMemberSchema);

/* ─── Seed ─────────────────────────────────────────────────────────────────── */
const DEFAULT_MEMBERS = [
  { name: "Sarah Chen",   email: "sarah@company.com",  role: "Lead Engineer",    department: "Engineering", skills: ["bugs", "backend", "api"],               availability: "available" },
  { name: "Marcus Lee",   email: "marcus@company.com", role: "Senior Dev",       department: "Engineering", skills: ["bugs", "frontend", "performance"],       availability: "available" },
  { name: "Priya Sharma", email: "priya@company.com",  role: "Finance Manager",  department: "Finance",     skills: ["billing", "refunds", "invoices"],        availability: "available" },
  { name: "James Okafor", email: "james@company.com",  role: "Account Manager",  department: "Finance",     skills: ["billing", "subscriptions", "accounts"],  availability: "busy" },
  { name: "Emily Torres", email: "emily@company.com",  role: "Product Owner",    department: "Product",     skills: ["features", "roadmap", "feedback"],       availability: "available" },
  { name: "Alex Kim",     email: "alex@company.com",   role: "Support Lead",     department: "Support",     skills: ["general", "onboarding", "how-to"],       availability: "available" },
  { name: "Zoe Nguyen",   email: "zoe@company.com",    role: "Support Agent",    department: "Support",     skills: ["general", "account access", "setup"],    availability: "available" },
];

async function seedTeamMembers() {
  try {
    const count = await TeamMember.countDocuments();
    if (count === 0) {
      await TeamMember.insertMany(DEFAULT_MEMBERS);
      console.log("✅ Seeded default team members");
    }
  } catch (err) {
    console.error("❌ Seed error:", err.message);
  }
}

mongoose.connection.once("open", seedTeamMembers);

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function calculateSLA(urgency) {
  const u = (urgency || "").toLowerCase();
  const hours = u.includes("high") ? 2 : u.includes("medium") ? 24 : 48;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/* ─── POST /process ─────────────────────────────────────────────────────────── */
app.post("/process", async (req, res) => {
  const { email, subject, sender } = req.body;
  if (!email || !email.trim()) return res.status(400).json({ error: "Email text required" });

  try {
    const response = await axios.post(`${AI_SERVICE_URL}/analyze`, { email, subject, sender });
    const result = response.data;

    result.sla_due  = calculateSLA(result.urgency);
    result.subject  = result.subject  || subject || "";
    result.sender   = result.sender   || sender  || "";
    result.status   = "new";

    const newEmail = new Email({ email, ...result });
    await newEmail.save();

    res.json({ ...result, _id: newEmail._id, createdAt: newEmail.createdAt });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error processing email. The AI service is temporarily unavailable. Please try again." });
  }
});

/* ─── POST /gmail/fetch ─────────────────────────────────────────────────────── */
app.post("/gmail/fetch", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Access token required" });

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const response = await gmail.users.messages.list({ userId: "me", q: "is:unread in:inbox", maxResults: 10 });
    const messages = response.data.messages || [];
    if (messages.length === 0) return res.json({ count: 0, message: "No unread emails found." });

    const processedEmails = [];
    for (const msg of messages) {
      const msgDetails = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" });
      const payload = msgDetails.data.payload;
      const headers = payload.headers;
      const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value || "No Subject";
      const from    = headers.find((h) => h.name.toLowerCase() === "from")?.value || "Unknown Sender";
      const snippet = msgDetails.data.snippet || "";
      const emailContent = `From: ${from}\nSubject: ${subject}\n\n${snippet}`;

      try {
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, { email: emailContent, subject, sender: from });
        const result = aiResponse.data;
        result.sla_due = calculateSLA(result.urgency);
        result.subject = subject;
        result.sender  = from;
        result.status  = "new";
        const newEmail = new Email({ email: emailContent, ...result });
        await newEmail.save();
        processedEmails.push({ ...result, _id: newEmail._id, createdAt: newEmail.createdAt });
      } catch (err) {
        console.error("AI processing error for msg", msg.id, err.message);
      }
    }
    res.json({ count: processedEmails.length, emails: processedEmails });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not fetch or process Gmail messages." });
  }
});

/* ─── GET /history ──────────────────────────────────────────────────────────── */
app.get("/history", async (req, res) => {
  try {
    const records = await Email.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch history" });
  }
});

/* ─── DELETE /history/:id ───────────────────────────────────────────────────── */
app.delete("/history/:id", async (req, res) => {
  try {
    await Email.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Could not delete record" });
  }
});

/* ─── PATCH /history/:id/reassign ──────────────────────────────────────────── */
app.patch("/history/:id/reassign", async (req, res) => {
  const { team, recommended_member } = req.body;
  if (!team) return res.status(400).json({ error: "Team name required" });
  try {
    const update = { team };
    if (recommended_member) update.recommended_member = recommended_member;
    const updated = await Email.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Could not reassign" });
  }
});

/* ─── PATCH /history/:id/assign ────────────────────────────────────────────── */
app.patch("/history/:id/assign", async (req, res) => {
  const { assigned_to, team } = req.body;
  try {
    const update = { status: "assigned" };
    if (assigned_to) update.assigned_to = assigned_to;
    if (team) update.team = team;
    const updated = await Email.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Could not assign" });
  }
});

/* ─── PATCH /history/:id/escalate ──────────────────────────────────────────── */
app.patch("/history/:id/escalate", async (req, res) => {
  try {
    const updated = await Email.findByIdAndUpdate(
      req.params.id,
      { status: "escalated", urgency: "High" },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Could not escalate" });
  }
});

/* ─── PATCH /history/:id/snooze ────────────────────────────────────────────── */
app.patch("/history/:id/snooze", async (req, res) => {
  try {
    const updated = await Email.findByIdAndUpdate(req.params.id, { status: "snoozed" }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Could not snooze" });
  }
});

/* ─── PATCH /history/:id/read ──────────────────────────────────────────────── */
app.patch("/history/:id/read", async (req, res) => {
  try {
    const updated = await Email.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Could not mark as read" });
  }
});

/* ─── PATCH /history/:id/status ────────────────────────────────────────────── */
app.patch("/history/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status required" });
  try {
    const updated = await Email.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Could not update status" });
  }
});

/* ─── GET /stats ────────────────────────────────────────────────────────────── */
app.get("/stats", async (req, res) => {
  try {
    const total          = await Email.countDocuments();
    const highCount      = await Email.countDocuments({ urgency: /high/i });
    const mediumCount    = await Email.countDocuments({ urgency: /medium/i });
    const lowCount       = await Email.countDocuments({ urgency: /low/i });
    const resolvedCount  = await Email.countDocuments({ status: "resolved" });
    const assignedCount  = await Email.countDocuments({ status: "assigned" });
    const inProgressCount= await Email.countDocuments({ status: "in_progress" });
    const escalatedCount = await Email.countDocuments({ status: "escalated" });
    const snoozedCount   = await Email.countDocuments({ status: "snoozed" });
    const pendingCount   = await Email.countDocuments({ status: { $nin: ["resolved"] } });
    const breachedCount  = await Email.countDocuments({ status: { $ne: "resolved" }, sla_due: { $lt: new Date(), $exists: true } });
    const unreadHigh     = await Email.countDocuments({ urgency: /high/i, read: false });
    const billingCount   = await Email.countDocuments({ category: "Billing" });
    const newCount       = await Email.countDocuments({ status: "new" });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const resolvedToday = await Email.countDocuments({ status: "resolved", updatedAt: { $gte: todayStart } });

    const categoryPipeline  = await Email.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
    const teamPipeline      = await Email.aggregate([{ $group: { _id: "$team",     count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
    const sentimentPipeline = await Email.aggregate([{ $match: { sentiment: { $ne: null } } }, { $group: { _id: "$sentiment", count: { $sum: 1 } } }, { $sort: { count: -1 } }]);

    const confResult     = await Email.aggregate([{ $match: { confidence_score: { $exists: true, $ne: null } } }, { $group: { _id: null, avg: { $avg: "$confidence_score" } } }]);
    const avgConfidence  = confResult.length > 0 ? Math.round(confResult[0].avg * 100) : 0;
    const triagedPercent = total > 0 ? Math.round(((total - unreadHigh) / total) * 100) : 100;

    res.json({
      total, resolvedCount, pendingCount, breachedCount, resolvedToday, avgConfidence,
      assignedCount, inProgressCount, escalatedCount, snoozedCount, newCount, billingCount,
      urgency: { high: highCount, medium: mediumCount, low: lowCount },
      categories:  categoryPipeline.map((c) => ({ name: c._id || "Unknown",  count: c.count })),
      teams:       teamPipeline.map((t)    => ({ name: t._id || "Unknown",  count: t.count })),
      sentiments:  sentimentPipeline.map((s) => ({ name: s._id || "Neutral", count: s.count })),
      unreadHigh, triagedPercent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not compute stats" });
  }
});

/* ─── Team Members CRUD ─────────────────────────────────────────────────────── */
app.get("/team-members", async (req, res) => {
  try {
    const members = await TeamMember.find().sort({ department: 1, name: 1 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch team members" });
  }
});

app.post("/team-members", async (req, res) => {
  const { name, email, role, department, skills } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const member = new TeamMember({
      name, email: email || "", role: role || "Support Agent", department: department || "Support",
      skills: Array.isArray(skills) ? skills : (skills || "").split(",").map(s => s.trim()).filter(Boolean),
    });
    await member.save();
    res.json(member);
  } catch (err) {
    res.status(500).json({ error: "Could not create team member" });
  }
});

app.patch("/team-members/:id", async (req, res) => {
  try {
    const { name, email, role, department, skills, availability } = req.body;
    const update = {};
    if (name)               update.name         = name;
    if (email !== undefined) update.email        = email;
    if (role)               update.role         = role;
    if (department)         update.department   = department;
    if (skills)             update.skills       = Array.isArray(skills) ? skills : skills.split(",").map(s => s.trim()).filter(Boolean);
    if (availability)       update.availability = availability;
    const updated = await TeamMember.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Could not update team member" });
  }
});

app.delete("/team-members/:id", async (req, res) => {
  try {
    await TeamMember.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Could not delete team member" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Server running on port ${PORT}`));
