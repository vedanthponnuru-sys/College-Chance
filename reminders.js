const LAST_UPDATED_KEY = "collegeChance.profileLastUpdated";
const SNOOZE_KEY = "collegeChance.semesterReminderSnoozedUntil";
const PRIVACY_SEEN_KEY = "collegeChance.privacySeen";

export function getLastUpdated() {
  try {
    const raw = localStorage.getItem(LAST_UPDATED_KEY);
    return raw ? new Date(raw) : null;
  } catch (err) {
    console.warn("Could not read last-updated date from localStorage:", err);
    return null;
  }
}

export function markProfileUpdated() {
  try {
    localStorage.setItem(LAST_UPDATED_KEY, new Date().toISOString());
    return true;
  } catch (err) {
    console.warn("Could not save last-updated date to localStorage:", err);
    return false;
  }
}

export function formatLastUpdated(date) {
  if (!date) return "never";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function mostRecentSemesterEnd(now = new Date()) {
  const year = now.getFullYear();
  const checkpoints = [
    new Date(year - 1, 5, 30, 23, 59, 59),
    new Date(year, 0, 31, 23, 59, 59),
    new Date(year, 5, 30, 23, 59, 59)
  ];
  const past = checkpoints.filter((checkpoint) => checkpoint <= now);
  return past[past.length - 1];
}

export function needsSemesterUpdate(lastUpdated, now = new Date()) {
  if (!lastUpdated) return false;
  return lastUpdated < mostRecentSemesterEnd(now);
}

export function isReminderSnoozed(now = new Date()) {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    return new Date(raw) > now;
  } catch (err) {
    console.warn("Could not read reminder snooze state from localStorage:", err);
    return false;
  }
}

export function snoozeReminder(days = 7) {
  try {
    const until = new Date();
    until.setDate(until.getDate() + days);
    localStorage.setItem(SNOOZE_KEY, until.toISOString());
    return true;
  } catch (err) {
    console.warn("Could not save reminder snooze state to localStorage:", err);
    return false;
  }
}

export function hasSeenPrivacyPanel() {
  try {
    return localStorage.getItem(PRIVACY_SEEN_KEY) === "true";
  } catch (err) {
    console.warn("Could not read privacy-panel state from localStorage:", err);
    return false;
  }
}

export function markPrivacyPanelSeen() {
  try {
    localStorage.setItem(PRIVACY_SEEN_KEY, "true");
    return true;
  } catch (err) {
    console.warn("Could not save privacy-panel state to localStorage:", err);
    return false;
  }
}

function nextDateOnOrAfter(now, month, day) {
  const year = now.getFullYear();
  let candidate = new Date(year, month - 1, day);
  if (candidate < now) {
    candidate = new Date(year + 1, month - 1, day);
  }
  return candidate;
}

function formatICSDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatICSDateTime(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildReminderEvent(uid, date, now) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICSDateTime(now)}`,
    `DTSTART;VALUE=DATE:${formatICSDate(date)}`,
    "RRULE:FREQ=YEARLY",
    "SUMMARY:Update your grades on College Chance",
    "DESCRIPTION:Semester update reminder: refresh your GPA\\, courses and test scores on College Chance so your college matches stay accurate.",
    "END:VEVENT"
  ];
}

export function buildReminderICS(now = new Date()) {
  const febDate = nextDateOnOrAfter(now, 2, 1);
  const julDate = nextDateOnOrAfter(now, 7, 1);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//College Chance//Grade Update Reminders//EN",
    "CALSCALE:GREGORIAN",
    ...buildReminderEvent("collegechance-feb-reminder@collegechance.app", febDate, now),
    ...buildReminderEvent("collegechance-jul-reminder@collegechance.app", julDate, now),
    "END:VCALENDAR"
  ];

  return lines.join("\r\n");
}

export function downloadICS(icsText) {
  const blob = new Blob([icsText], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "college-chance-grade-update-reminders.ics";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
