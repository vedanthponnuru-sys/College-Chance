export const DASHBOARD_FOOTER =
  "Estimates and general guidance only. Check requirements with your school counselor and each college.";

export const CORE_UNITS = { "English": 4, "Math": 4, "Science": 3, "Social Studies": 3, "World Language": 2 };
const TOTAL_CORE_UNITS = Object.values(CORE_UNITS).reduce((sum, n) => sum + n, 0);

const UPCOMING_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

let milestonesCache = null;

export async function loadMilestones() {
  if (milestonesCache) return milestonesCache;
  const response = await fetch("data/milestones.json");
  if (!response.ok) {
    throw new Error(`Could not load milestones (status ${response.status})`);
  }
  milestonesCache = await response.json();
  return milestonesCache;
}

export function corePlanCompletion(courses) {
  let units = 0;
  Object.entries(CORE_UNITS).forEach(([subject, needed]) => {
    const years = new Set(
      courses.filter((c) => c.subject === subject && c.status === "Completed").map((c) => c.schoolYear)
    );
    units += Math.min(years.size, needed);
  });
  return { units, total: TOTAL_CORE_UNITS, percent: Math.round((units / TOTAL_CORE_UNITS) * 100) };
}

function nextOccurrence(month, day, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date = new Date(now.getFullYear(), month - 1, day);
  if (date < today) date = new Date(now.getFullYear() + 1, month - 1, day);
  return date;
}

export function gradeOnDate(grade, now, date) {
  let crossings = 0;
  for (let year = now.getFullYear(); year <= date.getFullYear(); year++) {
    const newSchoolYear = new Date(year, 7, 1);
    if (newSchoolYear > now && newSchoolYear <= date) crossings += 1;
  }
  return grade + crossings;
}

export function upcomingMilestones(data, grade, now = new Date(), days = UPCOMING_DAYS) {
  if (!data || typeof grade !== "number") return [];
  const limit = new Date(now.getTime() + days * DAY_MS);
  return data.milestones
    .map((milestone) => ({ ...milestone, date: nextOccurrence(milestone.month, milestone.day, now) }))
    .filter((milestone) => milestone.date <= limit && milestone.grades.includes(gradeOnDate(grade, now, milestone.date)))
    .sort((a, b) => a.date - b.date);
}

export function careerFor(major, typedMajor) {
  if (major && major.career) {
    return { icon: major.career.icon, title: major.career.title, field: major.career.field, group: major.career.group, set: true };
  }
  if (typedMajor) {
    return { icon: "🎯", title: typedMajor, field: "Intended major", group: "default", set: true };
  }
  return { icon: "🎯", title: "Add your career goal", field: "Pick an intended major to personalize your plan", group: "default", set: false };
}

const ROADMAP_THEMES = {
  default: ["Build strong foundations", "Explore and challenge yourself", "Go deeper, lead & test", "Applications & final requirements"],
  cs: ["Build strong foundations", "Math, science & programming", "Advanced math, AP CS & testing", "Applications & final requirements"],
  engineering: ["Build strong foundations", "Math, physics & building things", "Calculus, physics & testing", "Applications & final requirements"],
  science: ["Build strong foundations", "Chemistry, math & labs", "AP sciences, research & testing", "Applications & final requirements"],
  health: ["Build strong foundations", "Biology, chemistry & service", "AP science, volunteering & testing", "Applications & final requirements"],
  business: ["Build strong foundations", "Math, economics & leadership", "Statistics, AP Econ & testing", "Applications & final requirements"],
  humanities: ["Build strong foundations", "Writing, history & debate", "AP English, history & testing", "Applications & final requirements"],
  social: ["Build strong foundations", "Social sciences & service", "AP Psychology, statistics & testing", "Applications & final requirements"],
  arts: ["Build strong foundations", "Build skills & your portfolio", "Advanced art, portfolio & testing", "Applications & final requirements"],
  environment: ["Build strong foundations", "Biology, earth science & the outdoors", "AP Environmental Science & testing", "Applications & final requirements"]
};

export function roadmapRows(grade, courses, group) {
  const themes = ROADMAP_THEMES[group] || ROADMAP_THEMES.default;
  const current = typeof grade === "number" && grade >= 9 ? grade : null;
  return [9, 10, 11, 12].map((year, i) => {
    const yearCourses = courses.filter((c) => c.schoolYear === year);
    const completed = yearCourses.filter((c) => c.status === "Completed").length;
    let status = "Planned";
    if (current && year < current) status = "Completed";
    else if (current && year === current) status = "In progress";
    return {
      year,
      theme: themes[i],
      status,
      percent: yearCourses.length ? Math.round((completed / yearCourses.length) * 100) : 0,
      summary: yearCourses.length ? `${completed} of ${yearCourses.length} course${yearCourses.length === 1 ? "" : "s"} completed` : "No courses added yet"
    };
  });
}

function testingStep(grade) {
  if (grade === 10) return "Take the PSAT in October as practice — no pressure, it doesn't go to colleges.";
  if (grade === 11) return "Plan your SAT or ACT for spring of 11th grade, after the October PSAT.";
  if (grade === 12) return "Finish any SAT/ACT retakes by fall and send scores to the colleges that want them.";
  return null;
}

export function nextSteps({ grade, corePlan, semesterDue, myColleges, documents, checklistTypes, activities, hasCourses, hasMajor, needsGpa }) {
  const steps = [];

  if (semesterDue) steps.push("New semester — update your grades and courses so your estimates stay accurate.");

  if (!hasCourses) {
    steps.push("Add the courses you're taking (or planning) in My Courses to build your 4-year plan.");
  } else if (corePlan) {
    const missing = corePlan.find((item) => item.status === "missing" && item.yearsLogged === 0);
    if (missing) steps.push(`Add a ${missing.subject} course — you have 0 of ${missing.yearsRequired} years planned.`);
  }

  const math = corePlan && corePlan.find((item) => item.subject === "Math");
  if (math && math.nextCourse && hasCourses) steps.push(`Next math course to plan: ${math.nextCourse}.`);

  const testing = testingStep(grade);
  if (testing) steps.push(testing);

  if (myColleges.length > 0) {
    const missingCounts = {};
    myColleges.forEach((college) => {
      const have = new Set(documents.filter((d) => d.collegeIds.includes(college.id)).map((d) => d.docType));
      checklistTypes.forEach((type) => {
        if (!have.has(type)) missingCounts[type] = (missingCounts[type] || 0) + 1;
      });
    });
    const [type, count] = Object.entries(missingCounts).sort((a, b) => b[1] - a[1])[0] || [];
    if (type) steps.push(`Upload your ${type} — ${count} college${count === 1 ? "" : "s"} on your list still need${count === 1 ? "s" : ""} it.`);
  } else if (typeof grade === "number" && grade >= 11) {
    steps.push("Start your college list in Search Colleges.");
  }

  if (activities.length === 0) steps.push("Add your activities — clubs, sports, jobs and family duties all count.");
  if (needsGpa) steps.push("Add your GPA on My Profile to see your Reach / Target / Safety estimates.");
  if (!hasMajor) steps.push("Pick an intended major so your plan and ideas fit your goals.");
  steps.push("Export a backup from My Profile so you never lose your plan.");

  return steps.slice(0, 3);
}
