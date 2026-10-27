import { loadProfile, saveProfile, loadMyList, saveMyList } from "./profile.js";
import {
  loadColleges,
  findCollegeById,
  loadMajors,
  findMajor,
  majorFit,
  describeMajorFit,
  filterAndSortColleges
} from "./search.js";
import { getChance } from "./chances.js";
import {
  GRADE_OPTIONS,
  gradeLabel,
  gradeBadgeText,
  hasGpaYet,
  currentSchoolYear,
  schoolYearsForStatus,
  schoolYearQuestion
} from "./grade.js";
import {
  DOC_TYPES,
  CHECKLIST_DOC_TYPES,
  isAllowedFileType,
  addDocument,
  getAllDocuments,
  deleteDocument,
  getDocumentsForCollege,
  downloadDocument
} from "./documents.js";
import {
  loadIdentity,
  saveIdentity,
  hasIdentity,
  gradYearOptions,
  buildBackup,
  downloadBackup,
  parseBackup
} from "./onboarding.js";
import {
  TUTORIAL_STEPS,
  stepDescription,
  hasTutorialCompleted,
  markTutorialComplete,
  positionTooltip
} from "./tutorial.js";
import {
  getLastUpdated,
  markProfileUpdated,
  formatLastUpdated,
  needsSemesterUpdate,
  isReminderSnoozed,
  snoozeReminder,
  hasSeenPrivacyPanel,
  markPrivacyPanelSeen,
  buildReminderICS,
  downloadICS
} from "./reminders.js";
import {
  SUBJECTS,
  LEVELS,
  SEMESTERS,
  LETTER_GRADES,
  SCHOOL_YEAR_LABELS,
  loadCourses,
  saveCourses,
  nextCourseId,
  getAllowedStatuses,
  describeCourseTier,
  countApHonorsCourses,
  groupCoursesByYear
} from "./courses.js";
import { buildRecommendations } from "./recommendations.js";
import { createCombobox } from "./combobox.js";
import {
  DASHBOARD_FOOTER,
  loadMilestones,
  corePlanCompletion,
  upcomingMilestones,
  careerFor,
  roadmapRows,
  nextSteps
} from "./dashboard.js";
import { loadCatalog, findCatalogCourse, comboboxOptionsFor, describeGrades as describeCatalogGrades } from "./catalog.js";
import {
  SUBJECT_ICONS,
  EXPLORE_SUBJECTS,
  PLAN_STATUS_LABELS,
  CATALOG_GROUPS,
  groupCatalogCourses,
  studentCatalogIds,
  progressPercent,
  yearsText
} from "./subjects.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_GRADES,
  loadActivities,
  saveActivities,
  nextActivityId,
  defaultActivityGrades,
  IDEAS_SHOWN_AT_FIRST,
  loadActivityIdeas,
  buildActivityIdeas
} from "./activities.js";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC"
];

const MAX_SEARCH_RESULTS = 20;

const SEARCH_DEBOUNCE_MS = 200;

let profile = loadProfile();
let myListIds = loadMyList();
let identity = loadIdentity();
let courses = loadCourses();
let activities = loadActivities();
let allColleges = [];
let allDocuments = [];
let majorsData = null;
let currentMajor = null;
let catalog = null;
let lastCorePlan = null;
let openSubject = null;
let openYear = null;
let editingCourseId = null;
let editingActivityId = null;
let showAllActivityIdeas = false;

let majorCombobox = null;
let courseNameCombobox = null;

let welcomeOverlayIsEditing = false;
let tutorialStepIndex = 0;
let privacyPanelThenStartTutorial = false;

async function init() {
  setUpProfileForm();
  setUpDashboard();
  setUpCourseForm();
  setUpSubjectPage();
  setUpActivityForm();
  setUpSearch();
  setUpDocumentsForm();
  setUpWelcomeForm();
  setUpBackup();
  setUpTutorial();
  setUpPrivacyPanel();
  setUpSemesterBanner();
  renderGreeting();
  renderGradeDependentProfile();
  renderLastUpdated();
  renderCoursesTierHint();
  renderCoursesList();
  renderApCountDisplay();
  renderSuggestions();
  renderActivitiesList();

  if (!hasIdentity(identity)) {
    openWelcomeOverlay({ isEditing: false });
  } else {
    maybeShowPostOnboardingOverlays();
  }

  maybeShowSemesterBanner();

  try {
    catalog = await loadCatalog();
  } catch (err) {
    console.error("Failed to load course catalog:", err);
    catalog = null;
  }
  updateCourseSuggestions();
  applyCatalogMatch();
  if (!document.getElementById("subject-page").hidden) renderSubjectPage(openSubject);

  try {
    majorsData = await loadMajors();
    renderMajorAutocomplete();
  } catch (err) {
    console.error("Failed to load majors data:", err);
    majorsData = null;
  }
  updateCurrentMajor({ resetToggle: true });
  renderSuggestions();
  renderActivityIdeas();

  try {
    allColleges = await loadColleges();
  } catch (err) {
    console.error("Failed to load college data:", err);
    allColleges = [];
  }
  document.getElementById("search-loading-hint").style.display = "none";

  try {
    allDocuments = await getAllDocuments();
  } catch (err) {
    console.error("Failed to load documents from IndexedDB:", err);
    allDocuments = [];
  }
  document.getElementById("documents-loading-hint").style.display = "none";

  refreshSearchResults();
  renderMyList();
  renderDocumentCheckboxes();
  renderDocumentsList();
  renderDashboard();
}

function setUpStateDropdown() {
  const select = document.getElementById("state");
  US_STATES.forEach((abbr) => {
    const option = document.createElement("option");
    option.value = abbr;
    option.textContent = abbr;
    select.appendChild(option);
  });
}
setUpStateDropdown();

const PROFILE_FIELD_RULES = [
  { id: "gpa", errorId: "gpa-error", min: 0, max: 4, label: "GPA must be between 0 and 4.0." },
  { id: "sat", errorId: "sat-error", min: 400, max: 1600, label: "SAT total must be between 400 and 1600." },
  { id: "act", errorId: "act-error", min: 1, max: 36, label: "ACT composite must be between 1 and 36." }
];

function renderGradeDependentProfile() {
  const grade = identity.grade;
  document.getElementById("grade-badge").textContent = gradeBadgeText(grade);
  document.getElementById("profile-grade-text").textContent = gradeLabel(grade);

  const showGpa = hasGpaYet(grade);
  document.getElementById("gpa-field").hidden = !showGpa;

  const details = document.getElementById("test-scores-details");
  details.classList.toggle("always-open", showGpa);
  if (showGpa || profile.sat !== null || profile.act !== null) details.open = true;
  else details.open = false;
}

function validateProfileField(rule) {
  const input = document.getElementById(rule.id);
  if (input.closest("[hidden]")) {
    input.classList.remove("invalid");
    document.getElementById(rule.errorId).textContent = "";
    return true;
  }
  const errorEl = document.getElementById(rule.errorId);
  const raw = input.value.trim();

  if (raw === "") {
    input.classList.remove("invalid");
    errorEl.textContent = "";
    return true;
  }

  const value = Number(raw);
  const isValid = !Number.isNaN(value) && value >= rule.min && value <= rule.max;
  input.classList.toggle("invalid", !isValid);
  errorEl.textContent = isValid ? "" : rule.label;
  return isValid;
}

function setUpProfileForm() {
  const form = document.getElementById("profile-form");

  if (profile.gpa !== null) form.gpa.value = profile.gpa;
  if (profile.sat !== null) form.sat.value = profile.sat;
  if (profile.act !== null) form.act.value = profile.act;
  if (profile.state) form.state.value = profile.state;

  PROFILE_FIELD_RULES.forEach((rule) => {
    const input = document.getElementById(rule.id);
    input.addEventListener("input", () => validateProfileField(rule));
    input.addEventListener("blur", () => validateProfileField(rule));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const allValid = PROFILE_FIELD_RULES.map(validateProfileField).every(Boolean);
    const msg = document.getElementById("profile-saved-msg");

    if (!allValid) {
      msg.textContent = "Please fix the highlighted fields before saving.";
      setTimeout(() => { msg.textContent = ""; }, 3000);
      return;
    }

    const gpaShown = !document.getElementById("gpa-field").hidden;
    profile = {
      gpa: gpaShown ? (form.gpa.value ? parseFloat(form.gpa.value) : null) : profile.gpa,
      sat: form.sat.value ? parseInt(form.sat.value, 10) : null,
      act: form.act.value ? parseInt(form.act.value, 10) : null,
      state: form.state.value || ""
    };

    const ok = saveProfile(profile);
    if (ok) {
      markProfileUpdated();
      renderLastUpdated();
      maybeShowSemesterBanner();
      renderSuggestions();
    }
    msg.textContent = ok ? "Saved!" : "Could not save — your browser may be blocking storage.";
    setTimeout(() => { msg.textContent = ""; }, 2500);

    renderMyList();
  });

  document.getElementById("add-calendar-reminder-btn").addEventListener("click", () => {
    downloadICS(buildReminderICS());
  });

  document.getElementById("profile-change-grade-btn").addEventListener("click", () => {
    openWelcomeOverlay({ isEditing: true });
    document.getElementById("welcome-grade").focus();
  });
}

function focusFirstProfileField() {
  if (!document.getElementById("gpa-field").hidden) {
    document.getElementById("gpa").focus();
    return;
  }
  document.getElementById("test-scores-details").open = true;
  document.getElementById("sat").focus();
}

function renderLastUpdated() {
  const el = document.getElementById("profile-last-updated");
  el.textContent = `Last updated: ${formatLastUpdated(getLastUpdated())}`;
}

function renderApCountDisplay() {
  const count = countApHonorsCourses(courses);
  document.getElementById("profile-ap-count-display").textContent =
    `${count} course${count === 1 ? "" : "s"} (Honors, AP, IB or Dual Enrollment, Completed or In progress — calculated from My Courses).`;
}

function renderCoursesTierHint() {
  document.getElementById("courses-tier-hint").textContent = describeCourseTier(identity.grade);
}

const STATUS_BADGE_CLASSES = {
  "on-track": "badge-safety",
  "one-more-year": "badge-target",
  "missing": "badge-reach"
};

function setUpSubjectPage() {
  document.getElementById("subject-back-btn").addEventListener("click", () => closeSubjectPage());
  document.getElementById("subject-page").addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSubjectPage();
  });
  document.getElementById("tabbtn-courses").addEventListener("click", () => closeSubjectPage({ focusCard: false }));
}

async function renderSuggestions() {
  const card = document.getElementById("suggestions-card");
  try {
    const majorForGuidance = currentMajor ? currentMajor.name : identity.major;
    const data = await buildRecommendations({ courses, profile, identity: { ...identity, major: majorForGuidance } });
    renderCorePlan(data.corePlan);
    renderNcCheck(data.ncCheck);
    renderRigor(data.rigor);
    renderMajorSuggestions(data.majorSuggestions);
    renderSeniorNote(data.seniorNote);
    document.getElementById("suggestions-footer-note").textContent = data.footerNote;
    card.hidden = false;
  } catch (err) {
    console.error("Failed to build course suggestions:", err);
    card.hidden = true;
  }
  renderDashboard();
}

function setUpDashboard() {
  document.getElementById("career-card").addEventListener("click", () => {
    openWelcomeOverlay({ isEditing: true });
    document.getElementById("welcome-major").focus();
  });

  const milestonesBtn = document.getElementById("milestones-btn");
  milestonesBtn.addEventListener("click", () => {
    const panel = document.getElementById("milestones-panel");
    panel.hidden = !panel.hidden;
    milestonesBtn.setAttribute("aria-expanded", String(!panel.hidden));
    milestonesBtn.querySelector(".stat-link").textContent = panel.hidden ? "Show list" : "Hide list";
  });

  document.getElementById("explore-roadmap-btn").addEventListener("click", () => {
    document.getElementById("tabbtn-courses").click();
    window.scrollTo({ top: 0 });
    document.getElementById("tabbtn-courses").focus({ preventScroll: true });
  });

  document.getElementById("dash-footer").textContent = DASHBOARD_FOOTER;
}

const ROADMAP_STATUS_CHIPS = { "Completed": "badge-safety", "In progress": "chip-current", "Planned": "chip-explore" };

async function renderDashboard() {
  const grade = identity.grade;
  document.getElementById("dash-grade-badge").textContent = gradeBadgeText(grade);

  const career = careerFor(currentMajor, identity.major);
  document.getElementById("career-icon").textContent = career.icon;
  document.getElementById("career-title").textContent = career.title;
  document.getElementById("career-field").textContent = career.field;
  document.getElementById("career-card").setAttribute("aria-label", `My career goal: ${career.title}, ${career.field}. Edit profile to change your major.`);

  const core = corePlanCompletion(courses);
  document.getElementById("core-percent").textContent = `${core.percent}%`;
  document.getElementById("core-progress").innerHTML = progressBarHtml(core.percent, "Core plan completed");
  document.getElementById("core-units").textContent = `${core.units} of ${core.total} core units completed`;

  const roadmap = document.getElementById("roadmap-list");
  roadmap.innerHTML = roadmapRows(grade, courses, career.group).map((row) => `
    <li class="roadmap-row">
      <span class="roadmap-grade">${row.year}th</span>
      <span class="roadmap-body">
        <span class="roadmap-top">
          <span class="roadmap-theme">${escapeHtml(row.theme)}</span>
          <span class="chip ${ROADMAP_STATUS_CHIPS[row.status]}">${row.status}</span>
        </span>
        ${progressBarHtml(row.percent, `${row.year}th grade progress`)}
        <span class="roadmap-summary">${escapeHtml(row.summary)}</span>
      </span>
    </li>
  `).join("");

  const myColleges = myListIds.map((id) => findCollegeById(allColleges, id)).filter(Boolean);
  const steps = nextSteps({
    grade,
    corePlan: lastCorePlan,
    semesterDue: needsSemesterUpdate(getLastUpdated()),
    myColleges,
    documents: allDocuments,
    checklistTypes: CHECKLIST_DOC_TYPES,
    activities,
    hasCourses: courses.length > 0,
    hasMajor: Boolean(identity.major),
    needsGpa: hasGpaYet(grade) && typeof profile.gpa !== "number"
  });
  document.getElementById("next-steps").innerHTML = steps.length
    ? steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")
    : "<li>You're all caught up — check back after your next semester.</li>";

  try {
    const milestoneData = await loadMilestones();
    const upcoming = upcomingMilestones(milestoneData, grade);
    document.getElementById("milestones-count").textContent = String(upcoming.length);
    document.getElementById("milestones-note").textContent = milestoneData.note;
    document.getElementById("milestones-list").innerHTML = upcoming.length
      ? upcoming.map((m) => `
        <li class="milestone">
          <span class="milestone-date">${m.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          <span class="milestone-body"><strong>${escapeHtml(m.title)}</strong><span>${escapeHtml(m.detail)}</span></span>
        </li>
      `).join("")
      : '<li class="hint">Nothing coming up in the next 90 days.</li>';
  } catch (err) {
    console.error("Failed to load milestones:", err);
    document.getElementById("milestones-count").textContent = "–";
  }
}

function progressBarHtml(percent, label) {
  return `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="${escapeHtml(label)}"><div class="progress-fill" style="width: ${percent}%"></div></div>`;
}

function buildPlanCard({ subject, progressText, percent, chipText, chipClass }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "plan-card";
  button.dataset.subject = subject;
  button.setAttribute("aria-label", `${subject}: ${progressText}, ${chipText}. Open ${subject} courses.`);
  button.innerHTML = `
    <span class="plan-card-top">
      <span class="plan-card-icon" aria-hidden="true">${SUBJECT_ICONS[subject] || "📘"}</span>
      <span class="chip ${chipClass}">${escapeHtml(chipText)}</span>
    </span>
    <span class="plan-card-name">${escapeHtml(subject)}</span>
    <span class="plan-card-progress">${escapeHtml(progressText)}</span>
    ${percent === null ? "" : progressBarHtml(percent, `${subject} progress`)}
  `;
  button.addEventListener("click", () => openSubjectPage(subject));
  return button;
}

function renderCorePlan(corePlan) {
  lastCorePlan = corePlan;
  const container = document.getElementById("suggestions-core-plan");
  container.innerHTML = `
    <h4>Core 4-Year Plan</h4>
    <p class="hint plan-hint">Select a subject to see what colleges expect and every course you can take.</p>
  `;

  const grid = document.createElement("div");
  grid.className = "plan-cards";
  corePlan.forEach((item) => {
    grid.appendChild(buildPlanCard({
      subject: item.subject,
      progressText: yearsText(item.yearsLogged, item.yearsRequired),
      percent: progressPercent(item.yearsLogged, item.yearsRequired),
      chipText: PLAN_STATUS_LABELS[item.status],
      chipClass: STATUS_BADGE_CLASSES[item.status]
    }));
  });
  container.appendChild(grid);

  const exploreHeading = document.createElement("h4");
  exploreHeading.textContent = "Explore";
  container.appendChild(exploreHeading);
  const exploreGrid = document.createElement("div");
  exploreGrid.className = "plan-cards";
  EXPLORE_SUBJECTS.forEach(({ subject }) => {
    const count = courses.filter((c) => c.subject === subject).length;
    exploreGrid.appendChild(buildPlanCard({
      subject,
      progressText: `${count} course${count === 1 ? "" : "s"} logged`,
      percent: null,
      chipText: "Explore",
      chipClass: "chip-explore"
    }));
  });
  container.appendChild(exploreGrid);

  if (!document.getElementById("subject-page").hidden) renderSubjectPage(openSubject);
}

function openSubjectPage(subject) {
  openSubject = subject;
  renderSubjectPage(subject);
  document.getElementById("courses-main").hidden = true;
  document.getElementById("subject-page").hidden = false;
  window.scrollTo({ top: 0 });
  document.getElementById("subject-back-btn").focus();
}

function closeSubjectPage({ focusCard = true } = {}) {
  const page = document.getElementById("subject-page");
  if (page.hidden) return;
  page.hidden = true;
  document.getElementById("courses-main").hidden = false;
  if (focusCard && openSubject) {
    const card = document.querySelector(`.plan-card[data-subject="${openSubject}"]`);
    if (card) {
      card.focus();
      card.scrollIntoView({ block: "center" });
    }
  }
}

function renderSubjectPage(subject) {
  const planItem = (lastCorePlan || []).find((item) => item.subject === subject);
  const explore = EXPLORE_SUBJECTS.find((e) => e.subject === subject);

  document.getElementById("subject-page-title").innerHTML =
    `<span aria-hidden="true">${SUBJECT_ICONS[subject] || "📘"}</span> ${escapeHtml(subject)}`;

  const rec = document.getElementById("subject-page-rec");
  if (planItem) {
    const percent = progressPercent(planItem.yearsLogged, planItem.yearsRequired);
    rec.innerHTML = `
      <p><strong>Recommendation:</strong> ${escapeHtml(planItem.recommendation)}</p>
      <div class="subject-rec-progress">
        <span>${escapeHtml(yearsText(planItem.yearsLogged, planItem.yearsRequired))}</span>
        <span class="chip ${STATUS_BADGE_CLASSES[planItem.status]}">${escapeHtml(PLAN_STATUS_LABELS[planItem.status])}</span>
      </div>
      ${progressBarHtml(percent, `${subject} progress`)}
      ${planItem.nextCourse ? `<p class="subject-next">Next up: <strong>${escapeHtml(planItem.nextCourse)}</strong></p>` : ""}
      ${planItem.beyondNote ? `<p class="hint">${escapeHtml(planItem.beyondNote)}</p>` : ""}
    `;
  } else {
    rec.innerHTML = `<p><strong>Explore:</strong> ${escapeHtml(explore ? explore.recommendation : "")}</p>`;
  }

  const mine = courses
    .filter((c) => c.subject === subject)
    .sort((a, b) => a.schoolYear - b.schoolYear);
  document.getElementById("subject-page-mine").innerHTML = mine.length === 0
    ? `<p class="hint">No ${escapeHtml(subject)} courses yet.</p>`
    : `<ul class="mine-chips">${mine.map((c) => `<li class="course-chip"><strong>${escapeHtml(c.name)}</strong> <span>${escapeHtml(`${SCHOOL_YEAR_LABELS[c.schoolYear] || ""} · ${c.level} · ${c.status}`)}</span></li>`).join("")}</ul>`;

  const container = document.getElementById("subject-page-catalog");
  container.innerHTML = "";
  if (!catalog) {
    container.innerHTML = '<p class="hint">The course catalog is still loading.</p>';
    return;
  }

  const haveIds = studentCatalogIds(catalog, courses);
  const groups = groupCatalogCourses(catalog, subject);
  CATALOG_GROUPS.forEach((groupName) => {
    const list = groups[groupName];
    if (list.length === 0) return;
    const section = document.createElement("section");
    section.className = "catalog-group";
    const isHonors = groupName === "Honors";
    section.innerHTML = `
      <h4>${escapeHtml(groupName)} <span class="catalog-count">${list.length}</span></h4>
      ${isHonors ? '<p class="hint">Most schools offer an Honors version of these courses. Honors is set by your school, not a national exam.</p>' : ""}
      <ul class="catalog-list${isHonors ? " compact" : ""}"></ul>
    `;
    const ul = section.querySelector("ul");
    list.forEach((course) => ul.appendChild(buildCatalogCourseItem(course, { haveIds, honors: isHonors })));
    container.appendChild(section);
  });
}

function buildCatalogCourseItem(course, { haveIds, honors }) {
  const li = document.createElement("li");
  li.className = "catalog-course";
  const added = haveIds.has(course.id);
  const levelBadges = course.levels.map((level) => `<span class="level-badge">${escapeHtml(level)}</span>`).join("");
  const prereqs = course.prerequisites.length ? course.prerequisites.join(", ") : "None";

  li.innerHTML = honors
    ? `
      <div class="catalog-course-head">
        <span class="catalog-course-name">${escapeHtml(course.name)} <span class="hint">(Honors)</span></span>
        ${added ? '<span class="added-check" aria-label="Already added">✓ Added</span>' : ""}
      </div>
    `
    : `
      <div class="catalog-course-head">
        <span class="catalog-course-name">${escapeHtml(course.name)}</span>
        ${added ? '<span class="added-check" aria-label="Already added">✓ Added</span>' : ""}
      </div>
      <p class="catalog-course-desc">${escapeHtml(course.description)}</p>
      <p class="catalog-course-meta">${escapeHtml(describeCatalogGrades(course.grades))} · Prerequisites: ${escapeHtml(prereqs)}${course.lab ? " · Lab science" : ""}</p>
      <div class="level-badges">${levelBadges}</div>
    `;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn-small";
  button.textContent = honors ? "Add as Honors" : "Add to my plan";
  button.setAttribute("aria-label", `${button.textContent}: ${course.name}`);
  button.addEventListener("click", () => prefillCourseForm(course, honors ? "Honors" : null));
  li.appendChild(button);
  return li;
}

function prefillCourseForm(course, level) {
  closeSubjectPage({ focusCard: false });
  if (editingCourseId !== null) cancelCourseEdit();
  const subjectSelect = document.getElementById("course-subject");
  subjectSelect.value = course.subject;
  updateCourseSuggestions();
  document.getElementById("course-name").value = course.name;
  applyCatalogMatch();
  if (level && course.levels.includes(level)) document.getElementById("course-level").value = level;

  const statusSelect = document.getElementById("course-status");
  if (Array.from(statusSelect.options).some((o) => o.value === "Planned")) statusSelect.value = "Planned";
  toggleCourseGradeField();
  const yearSelect = document.getElementById("course-year");
  const allowedYears = Array.from(yearSelect.options).map((o) => Number(o.value));
  const typical = course.grades.find((g) => allowedYears.includes(g));
  if (typical) yearSelect.value = String(typical);

  COURSE_FIELD_RULES.forEach(validateCourseField);
  const msg = document.getElementById("course-saved-msg");
  msg.textContent = `Filled in ${course.name}. Check the status and year, then press Add Course.`;
  setTimeout(() => { msg.textContent = ""; }, 6000);

  const form = document.getElementById("course-form");
  form.scrollIntoView({ block: "start" });
  statusSelect.focus();
}

function renderNcCheck(ncCheck) {
  const container = document.getElementById("suggestions-nc");

  if (!ncCheck) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.hidden = false;

  const itemsHtml = ncCheck.items
    .map(
      (item) =>
        `<li class="${item.met ? "have" : "missing"}">${item.met ? "✓" : "—"} ${escapeHtml(item.label)} — ${escapeHtml(item.detail)}</li>`
    )
    .join("");

  container.innerHTML = `
    <h4>UNC System Minimum Course Requirements</h4>
    <ul class="requirement-list">${itemsHtml}</ul>
    <p class="hint">${escapeHtml(ncCheck.languageNote)}</p>
    <p class="hint">${escapeHtml(ncCheck.disclaimer)}</p>
    <p class="hint"><a href="${ncCheck.source}" target="_blank" rel="noopener">Source: UNC System admission requirements</a></p>
  `;
}

function renderRigor(rigor) {
  const container = document.getElementById("suggestions-rigor");
  container.innerHTML = "<h4>Rigor</h4>";

  if (rigor.subjects.length > 0) {
    const list = document.createElement("ul");
    list.className = "suggestion-bullets";
    rigor.subjects.forEach((subject) => {
      const li = document.createElement("li");
      li.textContent = `${subject} is at Regular level — consider stepping up to Honors, AP, IB or Dual Enrollment.`;
      list.appendChild(li);
    });
    container.appendChild(list);
  } else {
    const coreSubjects = ["English", "Math", "Science", "Social Studies", "World Language"];
    const hasCore = courses.some((c) => coreSubjects.includes(c.subject));
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = hasCore
      ? "Your core courses are already at an elevated level — nice work."
      : "Add your core courses to see suggestions for stepping up to Honors, AP or IB.";
    container.appendChild(p);
  }

  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = rigor.balanceNote;
  container.appendChild(note);
}

function renderMajorSuggestions(majorSuggestions) {
  const container = document.getElementById("suggestions-major");
  container.innerHTML = `<h4>Suggested for ${escapeHtml(majorSuggestions.label)}</h4>`;

  if (majorSuggestions.courses.length > 0) {
    const list = document.createElement("ul");
    list.className = "suggestion-bullets";
    majorSuggestions.courses.forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;
      list.appendChild(li);
    });
    container.appendChild(list);
  } else {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = majorSuggestions.note || "You've already got all the commonly suggested courses for this major on your list.";
    container.appendChild(p);
  }
}

function renderSeniorNote(note) {
  const el = document.getElementById("suggestions-senior-note");
  if (note) {
    el.textContent = note;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

const COURSE_FIELD_RULES = [
  { id: "course-subject", errorId: "course-subject-error", label: "Select a subject." },
  { id: "course-name", errorId: "course-name-error", label: "Enter a course name." }
];

function validateCourseField(rule) {
  const input = document.getElementById(rule.id);
  const errorEl = document.getElementById(rule.errorId);
  const isValid = input.value.trim() !== "";
  input.classList.toggle("invalid", !isValid);
  errorEl.textContent = isValid ? "" : rule.label;
  return isValid;
}

function renderCourseStatusOptions() {
  const select = document.getElementById("course-status");
  const previousValue = select.value;
  const allowed = getAllowedStatuses(identity.grade);

  select.innerHTML = "";
  allowed.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    select.appendChild(option);
  });

  if (allowed.includes(previousValue)) select.value = previousValue;
  toggleCourseGradeField();
}

function renderCourseYearOptions() {
  const status = document.getElementById("course-status").value;
  const select = document.getElementById("course-year");
  const previousValue = select.value;
  const years = schoolYearsForStatus(status, identity.grade);

  document.getElementById("course-year-label").textContent = schoolYearQuestion(status);
  select.innerHTML = "";
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = SCHOOL_YEAR_LABELS[year] + (year === currentSchoolYear(identity.grade) ? " (this year)" : "");
    select.appendChild(option);
  });

  const current = String(currentSchoolYear(identity.grade));
  if (years.map(String).includes(previousValue)) select.value = previousValue;
  else if (years.map(String).includes(current)) select.value = current;

  const fixed = status === "In progress";
  select.disabled = fixed;
  const hint = document.getElementById("course-year-hint");
  hint.hidden = !fixed;
  hint.textContent = fixed ? "In-progress courses are for your current grade." : "";
}

function toggleCourseGradeField() {
  const status = document.getElementById("course-status").value;
  document.getElementById("course-grade-field").hidden = status !== "Completed";
  renderCourseYearOptions();
}

function currentCatalogMatch() {
  return findCatalogCourse(catalog, document.getElementById("course-name").value);
}

function toggleCourseLabField() {
  const subject = document.getElementById("course-subject").value;
  const match = currentCatalogMatch();
  const labBox = document.getElementById("course-lab");
  const labHint = document.getElementById("course-lab-hint");
  document.getElementById("course-lab-field").hidden = subject !== "Science";
  if (match) {
    labBox.checked = Boolean(match.lab);
    labBox.disabled = true;
    labHint.hidden = false;
    labHint.textContent = match.lab ? "Marked as a lab science from the course catalog." : "This course isn't a lab science in the course catalog.";
  } else {
    labBox.disabled = false;
    labHint.hidden = true;
  }
}

function renderLevelOptions(levels) {
  const select = document.getElementById("course-level");
  const previousValue = select.value;
  select.innerHTML = "";
  levels.forEach((level) => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = level;
    select.appendChild(option);
  });
  if (levels.includes(previousValue)) select.value = previousValue;
}

function applyCatalogMatch() {
  const nameInput = document.getElementById("course-name");
  const subjectSelect = document.getElementById("course-subject");
  const match = currentCatalogMatch();
  const hint = document.getElementById("course-level-hint");

  if (match && subjectSelect.value !== match.subject) {
    subjectSelect.value = match.subject;
    updateCourseSuggestions();
    validateCourseField(COURSE_FIELD_RULES[0]);
  }

  renderLevelOptions(match ? match.levels : LEVELS);
  if (match) {
    hint.textContent = match.levels.length === 1
      ? `${match.name} is only taken at the ${match.levels[0]} level.`
      : `Levels for this course: ${match.levels.join(", ")}.`;
  } else {
    hint.textContent = nameInput.value.trim() ? "Not in our course catalog, so every level is available." : "";
  }
  hint.hidden = hint.textContent === "";
  toggleCourseLabField();
}

function updateCourseSuggestions() {
  const subject = document.getElementById("course-subject").value;
  courseNameCombobox.setOptions(comboboxOptionsFor(catalog, subject));
}

function setUpCourseForm() {
  const subjectSelect = document.getElementById("course-subject");
  SUBJECTS.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    subjectSelect.appendChild(option);
  });

  renderLevelOptions(LEVELS);

  const semesterSelect = document.getElementById("course-semester");
  SEMESTERS.forEach((semester) => {
    const option = document.createElement("option");
    option.value = semester;
    option.textContent = semester;
    semesterSelect.appendChild(option);
  });

  const gradeSelect = document.getElementById("course-grade");
  LETTER_GRADES.forEach((letter) => {
    const option = document.createElement("option");
    option.value = letter;
    option.textContent = letter;
    gradeSelect.appendChild(option);
  });

  const nameInput = document.getElementById("course-name");
  courseNameCombobox = createCombobox(nameInput, {
    onSelect: () => validateCourseField(COURSE_FIELD_RULES[1])
  });
  nameInput.addEventListener("input", applyCatalogMatch);
  nameInput.addEventListener("change", applyCatalogMatch);

  renderCourseStatusOptions();
  toggleCourseLabField();
  updateCourseSuggestions();

  COURSE_FIELD_RULES.forEach((rule) => {
    document.getElementById(rule.id).addEventListener("blur", () => validateCourseField(rule));
  });

  subjectSelect.addEventListener("change", () => {
    const match = currentCatalogMatch();
    if (match && match.subject !== subjectSelect.value) nameInput.value = "";
    updateCourseSuggestions();
    applyCatalogMatch();
    validateCourseField(COURSE_FIELD_RULES[0]);
  });

  document.getElementById("course-status").addEventListener("change", toggleCourseGradeField);

  document.getElementById("course-form").addEventListener("submit", (event) => {
    event.preventDefault();
    addCourseFromForm({ keepSubjectAndYear: false });
  });

  document.getElementById("course-add-another-btn").addEventListener("click", () => {
    addCourseFromForm({ keepSubjectAndYear: true });
  });

  document.getElementById("course-cancel-edit-btn").addEventListener("click", cancelCourseEdit);
}

function addCourseFromForm({ keepSubjectAndYear }) {
  const allValid = COURSE_FIELD_RULES.map(validateCourseField).every(Boolean);
  const msg = document.getElementById("course-saved-msg");

  if (!allValid) {
    msg.textContent = "Please fix the highlighted fields before adding this course.";
    setTimeout(() => { msg.textContent = ""; }, 3000);
    return;
  }

  const subject = document.getElementById("course-subject").value;
  const name = document.getElementById("course-name").value.trim();
  const level = document.getElementById("course-level").value;
  const schoolYear = parseInt(document.getElementById("course-year").value, 10);
  const semester = document.getElementById("course-semester").value;
  const status = document.getElementById("course-status").value;
  const gradeHidden = document.getElementById("course-grade-field").hidden;
  const grade = !gradeHidden ? document.getElementById("course-grade").value : null;
  const isLabScience = subject === "Science" && document.getElementById("course-lab").checked;
  const match = currentCatalogMatch();
  const wasEditing = editingCourseId !== null;

  const saved = {
    id: wasEditing ? editingCourseId : nextCourseId(courses),
    catalogId: match ? match.id : null,
    subject,
    name: match ? match.name : name,
    level,
    schoolYear,
    semester,
    status,
    grade,
    isLabScience
  };
  if (wasEditing) {
    courses = courses.map((course) => (course.id === editingCourseId ? saved : course));
    setCourseFormEditing(null);
  } else {
    courses.push(saved);
  }
  openYear = schoolYear;

  saveCourses(courses);
  markProfileUpdated();
  renderLastUpdated();
  maybeShowSemesterBanner();
  renderCoursesList();
  renderApCountDisplay();
  renderSuggestions();

  const form = document.getElementById("course-form");
  form.reset();
  if (keepSubjectAndYear) {
    document.getElementById("course-subject").value = subject;
    document.getElementById("course-year").value = String(schoolYear);
  }
  renderCourseStatusOptions();
  updateCourseSuggestions();
  applyCatalogMatch();

  COURSE_FIELD_RULES.forEach((rule) => {
    document.getElementById(rule.id).classList.remove("invalid");
    document.getElementById(rule.errorId).textContent = "";
  });

  msg.textContent = wasEditing ? "Changes saved!" : "Course added!";
  setTimeout(() => { msg.textContent = ""; }, 2500);
  if (wasEditing) {
    const row = document.querySelector(`.year-row[data-year="${schoolYear}"] .year-row-head`);
    if (row) {
      row.scrollIntoView({ block: "center" });
      row.focus();
    }
  } else {
    document.getElementById("course-name").focus();
  }
}

function setCourseFormEditing(courseId) {
  editingCourseId = courseId;
  const editing = courseId !== null;
  document.getElementById("course-submit-btn").textContent = editing ? "Save Changes" : "Add Course";
  document.getElementById("course-add-another-btn").hidden = editing;
  document.getElementById("course-cancel-edit-btn").hidden = !editing;
  document.getElementById("course-form").classList.toggle("editing", editing);
}

function editCourse(id) {
  const course = courses.find((c) => c.id === id);
  if (!course) return;
  closeSubjectPage({ focusCard: false });
  setCourseFormEditing(id);

  document.getElementById("course-subject").value = course.subject;
  updateCourseSuggestions();
  document.getElementById("course-name").value = course.name;
  applyCatalogMatch();
  const levelSelect = document.getElementById("course-level");
  if (Array.from(levelSelect.options).some((o) => o.value === course.level)) levelSelect.value = course.level;

  const statusSelect = document.getElementById("course-status");
  if (Array.from(statusSelect.options).some((o) => o.value === course.status)) statusSelect.value = course.status;
  toggleCourseGradeField();
  const yearSelect = document.getElementById("course-year");
  if (Array.from(yearSelect.options).some((o) => o.value === String(course.schoolYear))) yearSelect.value = String(course.schoolYear);
  document.getElementById("course-semester").value = course.semester;
  if (course.grade) document.getElementById("course-grade").value = course.grade;
  if (!currentCatalogMatch()) document.getElementById("course-lab").checked = Boolean(course.isLabScience);
  COURSE_FIELD_RULES.forEach(validateCourseField);

  const msg = document.getElementById("course-saved-msg");
  msg.textContent = `Editing ${course.name}. Make your changes, then press Save Changes.`;
  setTimeout(() => { msg.textContent = ""; }, 6000);
  document.getElementById("course-form").scrollIntoView({ block: "start" });
  document.getElementById("course-name").focus();
}

function cancelCourseEdit() {
  setCourseFormEditing(null);
  document.getElementById("course-form").reset();
  renderCourseStatusOptions();
  updateCourseSuggestions();
  applyCatalogMatch();
  COURSE_FIELD_RULES.forEach((rule) => {
    document.getElementById(rule.id).classList.remove("invalid");
    document.getElementById(rule.errorId).textContent = "";
  });
  document.getElementById("course-saved-msg").textContent = "";
}

function startAddingForYear(year) {
  cancelCourseEdit();
  const status = yearStatus(year);
  const statusSelect = document.getElementById("course-status");
  const wanted = status === "Completed" ? "Completed" : status === "In progress" ? "In progress" : "Planned";
  if (Array.from(statusSelect.options).some((o) => o.value === wanted)) statusSelect.value = wanted;
  toggleCourseGradeField();
  const yearSelect = document.getElementById("course-year");
  if (Array.from(yearSelect.options).some((o) => o.value === String(year))) yearSelect.value = String(year);
  document.getElementById("course-form").scrollIntoView({ block: "start" });
  document.getElementById("course-subject").focus();
}

function yearStatus(year) {
  const current = currentSchoolYear(identity.grade);
  if (!current) return "Planned";
  if (year < current) return "Completed";
  if (year === current) return "In progress";
  return "Planned";
}

const YEAR_STATUS_CHIPS = {
  "Completed": "badge-safety",
  "In progress": "chip-current",
  "Planned": "chip-explore"
};

function renderCoursesList() {
  const container = document.getElementById("year-rows");
  container.innerHTML = "";
  const grouped = groupCoursesByYear(courses);

  [9, 10, 11, 12].forEach((year) => {
    const yearCourses = (grouped[year] || []).slice().sort((a, b) => SUBJECTS.indexOf(a.subject) - SUBJECTS.indexOf(b.subject));
    const completed = yearCourses.filter((c) => c.status === "Completed").length;
    const percent = yearCourses.length ? Math.round((completed / yearCourses.length) * 100) : 0;
    const status = yearStatus(year);
    const label = SCHOOL_YEAR_LABELS[year];
    const row = document.createElement("div");
    row.className = "year-row";
    row.dataset.year = year;

    if (yearCourses.length === 0) {
      row.classList.add("empty");
      row.innerHTML = `
        <div class="year-row-head static">
          <span class="year-row-title"><span class="year-row-label">${escapeHtml(label)}</span><span class="chip ${YEAR_STATUS_CHIPS[status]}">${status}</span></span>
          <span class="year-row-summary">No courses added yet</span>
          ${progressBarHtml(0, `${label} progress`)}
        </div>
      `;
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn-small";
      addBtn.textContent = "Add courses";
      addBtn.setAttribute("aria-label", `Add courses for ${label}`);
      addBtn.addEventListener("click", () => startAddingForYear(year));
      row.querySelector(".year-row-head").appendChild(addBtn);
      container.appendChild(row);
      return;
    }

    const isOpen = openYear === year;
    const panelId = `year-panel-${year}`;
    row.innerHTML = `
      <button type="button" class="year-row-head" aria-expanded="${isOpen}" aria-controls="${panelId}">
        <span class="year-row-title">
          <span class="year-row-label">${escapeHtml(label)}</span>
          <span class="chip ${YEAR_STATUS_CHIPS[status]}">${status}</span>
          <span class="year-row-chevron" aria-hidden="true">▾</span>
        </span>
        <span class="year-row-summary">${completed} of ${yearCourses.length} course${yearCourses.length === 1 ? "" : "s"} completed</span>
        ${progressBarHtml(percent, `${label}: ${percent}% of courses completed`)}
      </button>
      <div class="year-row-panel" id="${panelId}" ${isOpen ? "" : "hidden"}>
        <ul class="year-course-chips"></ul>
      </div>
    `;
    row.querySelector(".year-row-head").addEventListener("click", () => {
      openYear = openYear === year ? null : year;
      renderCoursesList();
      const head = document.querySelector(`.year-row[data-year="${year}"] .year-row-head`);
      if (head) head.focus();
    });
    const list = row.querySelector(".year-course-chips");
    yearCourses.forEach((course) => list.appendChild(buildCourseChip(course)));
    container.appendChild(row);
  });
}

function buildCourseChip(course) {
  const li = document.createElement("li");
  li.className = "year-course-chip";
  const meta = [course.subject, course.level, course.semester, course.status];
  if (course.status === "Completed" && course.grade) meta.push(`Grade ${course.grade}`);
  if (course.subject === "Science" && course.isLabScience) meta.push("Lab");
  li.innerHTML = `
    <span class="chip-text"><strong>${escapeHtml(course.name)}</strong><span>${meta.map(escapeHtml).join(" · ")}</span></span>
    <span class="chip-actions"></span>
  `;
  const actions = li.querySelector(".chip-actions");
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn";
  editBtn.textContent = "✎";
  editBtn.title = "Edit";
  editBtn.setAttribute("aria-label", `Edit ${course.name}`);
  editBtn.addEventListener("click", () => editCourse(course.id));
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "icon-btn danger";
  deleteBtn.textContent = "✕";
  deleteBtn.title = "Delete";
  deleteBtn.setAttribute("aria-label", `Delete ${course.name}`);
  deleteBtn.addEventListener("click", () => removeCourse(course.id));
  actions.append(editBtn, deleteBtn);
  return li;
}

function removeCourse(id) {
  const removed = courses.find((course) => course.id === id);
  if (editingCourseId === id) cancelCourseEdit();
  courses = courses.filter((course) => course.id !== id);
  saveCourses(courses);
  markProfileUpdated();
  renderLastUpdated();
  maybeShowSemesterBanner();
  renderCoursesList();
  renderApCountDisplay();
  renderSuggestions();
  if (removed) {
    const row = document.querySelector(`.year-row[data-year="${removed.schoolYear}"]`);
    const target = row && (row.querySelector(".icon-btn") || row.querySelector(".year-row-head, .btn-small"));
    if (target) target.focus();
  }
}

const ACTIVITY_FIELD_RULES = [
  { id: "activity-name", errorId: "activity-name-error", label: "Enter the activity's name.", isValid: (v) => v !== "" },
  { id: "activity-category", errorId: "activity-category-error", label: "Select a category.", isValid: (v) => v !== "" },
  {
    id: "activity-hours",
    errorId: "activity-hours-error",
    label: "Hours per week must be between 0.5 and 80.",
    isValid: (v) => v !== "" && Number(v) >= 0.5 && Number(v) <= 80
  },
  {
    id: "activity-weeks",
    errorId: "activity-weeks-error",
    label: "Use a whole number from 1 to 52.",
    isValid: (v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 52)
  }
];

function validateActivityField(rule) {
  const input = document.getElementById(rule.id);
  const isValid = rule.isValid(input.value.trim());
  input.classList.toggle("invalid", !isValid);
  document.getElementById(rule.errorId).textContent = isValid ? "" : rule.label;
  return isValid;
}

function checkedActivityGrades() {
  return Array.from(document.querySelectorAll('#activity-grades input[type="checkbox"]:checked'))
    .map((checkbox) => parseInt(checkbox.value, 10));
}

function setActivityGrades(grades) {
  document.querySelectorAll('#activity-grades input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = grades.includes(parseInt(checkbox.value, 10));
  });
}

function resetActivityForm() {
  const form = document.getElementById("activity-form");
  form.reset();
  setActivityGrades(defaultActivityGrades(identity.grade));
  document.getElementById("activity-more").open = false;
  ACTIVITY_FIELD_RULES.forEach((rule) => {
    document.getElementById(rule.id).classList.remove("invalid");
    document.getElementById(rule.errorId).textContent = "";
  });
  setActivityFormEditing(null);
}

function setActivityFormEditing(activityId) {
  editingActivityId = activityId;
  const editing = activityId !== null;
  document.getElementById("activity-form-title").textContent = editing ? "Edit activity" : "Add an activity";
  document.getElementById("activity-submit-btn").textContent = editing ? "Save Changes" : "Add Activity";
  document.getElementById("activity-cancel-edit-btn").hidden = !editing;
  document.getElementById("activity-form").classList.toggle("editing", editing);
}

function editActivity(id) {
  const activity = activities.find((a) => a.id === id);
  if (!activity) return;
  closeActivityMenus();
  const form = document.getElementById("activity-form");
  setActivityFormEditing(id);
  form.name.value = activity.name;
  form.category.value = activity.category;
  form.role.value = activity.role || "";
  form.hoursPerWeek.value = activity.hoursPerWeek;
  form.leadership.checked = Boolean(activity.leadership);
  setActivityGrades(activity.grades || []);
  form.weeksPerYear.value = activity.weeksPerYear || "";
  form.achievement.value = activity.achievement || "";
  form.description.value = activity.description || "";
  document.getElementById("activity-more").open = Boolean(activity.weeksPerYear || activity.achievement || activity.description);
  form.scrollIntoView({ block: "start" });
  document.getElementById("activity-name").focus();
}

function setUpActivityForm() {
  const categorySelect = document.getElementById("activity-category");
  ACTIVITY_CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  const gradesContainer = document.getElementById("activity-grades");
  ACTIVITY_GRADES.forEach((grade) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = grade;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(`${grade}th`));
    gradesContainer.appendChild(label);
  });
  setActivityGrades(defaultActivityGrades(identity.grade));

  ACTIVITY_FIELD_RULES.forEach((rule) => {
    document.getElementById(rule.id).addEventListener("blur", () => validateActivityField(rule));
  });

  document.getElementById("activity-cancel-edit-btn").addEventListener("click", resetActivityForm);

  document.getElementById("activity-ideas-more").addEventListener("click", () => {
    showAllActivityIdeas = !showAllActivityIdeas;
    renderActivityIdeas();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".activity-menu-wrap")) closeActivityMenus();
  });

  const form = document.getElementById("activity-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const fieldsValid = ACTIVITY_FIELD_RULES.map(validateActivityField).every(Boolean);
    const msg = document.getElementById("activity-saved-msg");

    if (!fieldsValid) {
      if (!ACTIVITY_FIELD_RULES[3].isValid(form.weeksPerYear.value.trim())) document.getElementById("activity-more").open = true;
      msg.textContent = "Please fix the highlighted fields.";
      setTimeout(() => { msg.textContent = ""; }, 3000);
      return;
    }

    const wasEditing = editingActivityId !== null;
    const grades = checkedActivityGrades();
    const saved = {
      id: wasEditing ? editingActivityId : nextActivityId(activities),
      name: form.name.value.trim(),
      category: form.category.value,
      role: form.role.value.trim(),
      grades: grades.length ? grades : defaultActivityGrades(identity.grade),
      hoursPerWeek: parseFloat(form.hoursPerWeek.value),
      weeksPerYear: form.weeksPerYear.value ? parseInt(form.weeksPerYear.value, 10) : null,
      leadership: form.leadership.checked,
      achievement: form.achievement.value.trim(),
      description: form.description.value.trim()
    };
    activities = wasEditing
      ? activities.map((a) => (a.id === editingActivityId ? saved : a))
      : [...activities, saved];

    const ok = saveActivities(activities);
    renderActivitiesList();
    resetActivityForm();
    msg.textContent = !ok ? "Could not save — your browser may be blocking storage." : wasEditing ? "Changes saved!" : "Activity added!";
    setTimeout(() => { msg.textContent = ""; }, 2500);
    document.getElementById("activity-name").focus();
  });
}

function renderActivitiesList() {
  const list = document.getElementById("activities-list");
  list.innerHTML = "";
  document.getElementById("activities-empty-hint").style.display = activities.length === 0 ? "block" : "none";

  activities.forEach((activity) => {
    const li = document.createElement("li");
    li.className = "activity-card";
    const hrs = activity.hoursPerWeek === 1 ? "1 hr/week" : `${activity.hoursPerWeek} hrs/week`;
    const menuId = `activity-menu-${activity.id}`;

    li.innerHTML = `
      <div class="activity-card-main">
        <div class="activity-card-title">
          <span class="activity-name">${escapeHtml(activity.name)}</span>
          ${activity.leadership ? '<span class="leader-badge">★ Leader</span>' : ""}
        </div>
        <div class="activity-card-meta">
          <span class="chip chip-category">${escapeHtml(activity.category)}</span>
          ${activity.role ? `<span>${escapeHtml(activity.role)}</span>` : ""}
          <span>${escapeHtml(hrs)}</span>
        </div>
      </div>
      <div class="activity-menu-wrap">
        <button type="button" class="icon-btn kebab" aria-haspopup="menu" aria-expanded="false" aria-controls="${menuId}" aria-label="Options for ${escapeHtml(activity.name)}">⋯</button>
        <div class="activity-menu" id="${menuId}" role="menu" hidden>
          <button type="button" role="menuitem" data-action="edit">Edit</button>
          <button type="button" role="menuitem" data-action="delete" class="danger">Delete</button>
        </div>
      </div>
    `;

    const kebab = li.querySelector(".kebab");
    const menu = li.querySelector(".activity-menu");
    kebab.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = menu.hidden;
      closeActivityMenus();
      if (opening) {
        menu.hidden = false;
        kebab.setAttribute("aria-expanded", "true");
        menu.querySelector("button").focus();
      }
    });
    menu.addEventListener("keydown", (event) => {
      const items = Array.from(menu.querySelectorAll("button"));
      const index = items.indexOf(document.activeElement);
      if (event.key === "Escape") {
        closeActivityMenus();
        kebab.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1) % items.length].focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length].focus();
      }
    });
    menu.querySelector('[data-action="edit"]').addEventListener("click", () => editActivity(activity.id));
    menu.querySelector('[data-action="delete"]').addEventListener("click", () => removeActivity(activity.id));

    list.appendChild(li);
  });

  renderActivityIdeas();
  renderDashboard();
}

function closeActivityMenus() {
  document.querySelectorAll(".activity-menu").forEach((menu) => { menu.hidden = true; });
  document.querySelectorAll(".activity-card .kebab").forEach((button) => button.setAttribute("aria-expanded", "false"));
}

function removeActivity(id) {
  if (editingActivityId === id) resetActivityForm();
  activities = activities.filter((activity) => activity.id !== id);
  saveActivities(activities);
  renderActivitiesList();
  const firstKebab = document.querySelector(".activity-card .kebab");
  (firstKebab || document.getElementById("activity-name")).focus();
}

async function renderActivityIdeas() {
  const card = document.getElementById("activity-ideas-card");
  try {
    const ideasData = await loadActivityIdeas();
    const result = buildActivityIdeas({
      activities,
      grade: identity.grade,
      majorText: currentMajor ? currentMajor.name : identity.major,
      ideasData
    });

    document.getElementById("activity-stage").innerHTML =
      `<strong>${escapeHtml(result.stage.title)}.</strong> ${escapeHtml(result.stage.text)}`;

    const list = document.getElementById("activity-ideas-list");
    list.innerHTML = "";
    const moreBtn = document.getElementById("activity-ideas-more");
    const extra = result.ideas.length - IDEAS_SHOWN_AT_FIRST;
    moreBtn.hidden = extra <= 0;
    moreBtn.textContent = showAllActivityIdeas ? "Show fewer ideas" : `Show more ideas (${Math.max(extra, 0)})`;
    moreBtn.setAttribute("aria-expanded", String(showAllActivityIdeas));
    const shown = showAllActivityIdeas ? result.ideas : result.ideas.slice(0, IDEAS_SHOWN_AT_FIRST);
    shown.forEach((idea) => {
      const li = document.createElement("li");
      li.className = "suggestion-row";
      const examplesHtml = idea.examples && idea.examples.length > 0
        ? `<ul class="suggestion-bullets">${idea.examples.map((example) => `<li>${escapeHtml(example)}</li>`).join("")}</ul>`
        : "";
      li.innerHTML = `
        <span class="idea-title">${escapeHtml(idea.title)}</span>
        <p class="suggestion-detail">${escapeHtml(idea.text)}</p>
        ${examplesHtml}
      `;
      list.appendChild(li);
    });

    document.getElementById("activity-jobs-note").textContent = result.jobsNote;
    document.getElementById("activity-footer-note").textContent = result.footerNote;
    card.hidden = false;
  } catch (err) {
    console.error("Failed to build activity ideas:", err);
    card.hidden = true;
  }
}

const WELCOME_FIELD_RULES = [
  { id: "welcome-firstName", errorId: "welcome-firstName-error", label: "Enter your first name." },
  { id: "welcome-lastName", errorId: "welcome-lastName-error", label: "Enter your last name." },
  { id: "welcome-grade", errorId: "welcome-grade-error", label: "Select your grade." },
  { id: "welcome-highSchool", errorId: "welcome-highSchool-error", label: "Enter your high school." },
  { id: "welcome-gradYear", errorId: "welcome-gradYear-error", label: "Select your graduation year." }
];

function validateWelcomeField(rule) {
  const input = document.getElementById(rule.id);
  const errorEl = document.getElementById(rule.errorId);
  const isValid = input.value.trim() !== "";
  input.classList.toggle("invalid", !isValid);
  errorEl.textContent = isValid ? "" : rule.label;
  return isValid;
}

function openWelcomeOverlay({ isEditing }) {
  welcomeOverlayIsEditing = isEditing;

  const overlay = document.getElementById("welcome-overlay");
  const form = document.getElementById("welcome-form");

  document.getElementById("welcome-heading").textContent =
    isEditing ? "Edit Your Profile" : "Welcome to College Chance!";
  document.getElementById("welcome-subheading").textContent = isEditing
    ? "Update your info below. This stays on your device."
    : "Let's set up your profile — this stays on your device, there's no account or password.";
  document.getElementById("welcome-submit-btn").textContent = isEditing ? "Save Changes" : "Get Started";
  document.getElementById("welcome-cancel-btn").hidden = !isEditing;
  document.getElementById("welcome-import-hint").hidden = isEditing;

  form.reset();
  WELCOME_FIELD_RULES.forEach((rule) => {
    document.getElementById(rule.id).classList.remove("invalid");
    document.getElementById(rule.errorId).textContent = "";
  });

  if (isEditing) {
    form.firstName.value = identity.firstName || "";
    form.lastName.value = identity.lastName || "";
    form.grade.value = identity.grade || "";
    form.highSchool.value = identity.highSchool || "";
    form.gradYear.value = identity.gradYear || "";
    form.major.value = identity.major || "";
  }

  overlay.hidden = false;
  document.getElementById("welcome-firstName").focus();
}

function closeWelcomeOverlay() {
  document.getElementById("welcome-overlay").hidden = true;
}

function renderGreeting() {
  const greeting = document.getElementById("greeting");
  const greetingText = document.getElementById("greeting-text");

  if (!hasIdentity(identity)) {
    greeting.hidden = true;
    return;
  }

  greeting.hidden = false;
  greetingText.textContent = `Hi, ${identity.firstName}`;
}

function setUpWelcomeForm() {
  majorCombobox = createCombobox(document.getElementById("welcome-major"));

  const gradeSelect = document.getElementById("welcome-grade");
  GRADE_OPTIONS.forEach((grade) => {
    const option = document.createElement("option");
    option.value = grade.value;
    option.textContent = grade.label;
    gradeSelect.appendChild(option);
  });

  const yearSelect = document.getElementById("welcome-gradYear");
  gradYearOptions().forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });

  WELCOME_FIELD_RULES.forEach((rule) => {
    const input = document.getElementById(rule.id);
    input.addEventListener("blur", () => validateWelcomeField(rule));
  });

  const form = document.getElementById("welcome-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const allValid = WELCOME_FIELD_RULES.map(validateWelcomeField).every(Boolean);
    if (!allValid) return;

    const previousMajor = identity.major;
    identity = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      grade: parseInt(form.grade.value, 10),
      highSchool: form.highSchool.value.trim(),
      gradYear: parseInt(form.gradYear.value, 10),
      major: form.major.value.trim()
    };
    const wasFirstTimeOnboarding = !welcomeOverlayIsEditing;
    const majorChanged = previousMajor !== identity.major;

    saveIdentity(identity);
    if (majorChanged) {
      updateCurrentMajor({ resetToggle: true });
      refreshSearchResults();
    }
    renderEverythingForIdentity();
    closeWelcomeOverlay();

    if (wasFirstTimeOnboarding) {
      maybeShowPostOnboardingOverlays();
    }
  });

  document.getElementById("welcome-cancel-btn").addEventListener("click", () => {
    closeWelcomeOverlay();
  });

  document.getElementById("edit-profile-btn").addEventListener("click", () => {
    openWelcomeOverlay({ isEditing: true });
  });
}

function renderEverythingForIdentity() {
  renderGreeting();
  renderGradeDependentProfile();
  renderCoursesTierHint();
  renderCourseStatusOptions();
  renderCoursesList();
  renderSuggestions();
  if (editingActivityId === null) setActivityGrades(defaultActivityGrades(identity.grade));
  renderActivityIdeas();
  renderMyList();
}

function maybeShowPostOnboardingOverlays() {
  if (!hasSeenPrivacyPanel()) {
    openPrivacyPanel({ thenStartTutorial: !hasTutorialCompleted() });
  } else if (!hasTutorialCompleted()) {
    startTutorial();
  }
}

function setUpPrivacyPanel() {
  document.getElementById("show-privacy-btn").addEventListener("click", () => {
    openPrivacyPanel({ thenStartTutorial: false });
  });

  document.getElementById("privacy-close-btn").addEventListener("click", () => {
    closePrivacyPanel();
  });
}

function openPrivacyPanel({ thenStartTutorial }) {
  privacyPanelThenStartTutorial = thenStartTutorial;
  document.getElementById("privacy-overlay").hidden = false;
  document.getElementById("privacy-close-btn").focus();
}

function closePrivacyPanel() {
  document.getElementById("privacy-overlay").hidden = true;
  markPrivacyPanelSeen();

  if (privacyPanelThenStartTutorial) {
    privacyPanelThenStartTutorial = false;
    startTutorial();
  }
}

function setUpSemesterBanner() {
  document.getElementById("semester-update-btn").addEventListener("click", () => {
    hideSemesterBanner();
    document.getElementById("tabbtn-profile").click();
    focusFirstProfileField();
  });

  document.getElementById("semester-dismiss-btn").addEventListener("click", () => {
    snoozeReminder(7);
    hideSemesterBanner();
  });
}

function maybeShowSemesterBanner() {
  const due = needsSemesterUpdate(getLastUpdated());
  document.getElementById("semester-banner").hidden = !due || isReminderSnoozed();
}

function hideSemesterBanner() {
  document.getElementById("semester-banner").hidden = true;
}

function setUpTutorial() {
  document.getElementById("show-tutorial-btn").addEventListener("click", () => {
    startTutorial();
  });

  document.getElementById("tutorial-back-btn").addEventListener("click", () => {
    if (tutorialStepIndex > 0) renderTutorialStep(tutorialStepIndex - 1);
  });

  document.getElementById("tutorial-next-btn").addEventListener("click", () => {
    if (tutorialStepIndex < TUTORIAL_STEPS.length - 1) {
      renderTutorialStep(tutorialStepIndex + 1);
    } else {
      endTutorial({ markComplete: true });
    }
  });

  document.getElementById("tutorial-skip-btn").addEventListener("click", () => {
    endTutorial({ markComplete: true });
  });

  document.getElementById("tutorial-tooltip").addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      endTutorial({ markComplete: true });
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      document.getElementById("tutorial-next-btn").click();
    } else if (event.key === "ArrowLeft" && tutorialStepIndex > 0) {
      event.preventDefault();
      document.getElementById("tutorial-back-btn").click();
    } else if (event.key === "Tab") {
      trapTutorialFocus(event);
    }
  });

  window.addEventListener("resize", () => {
    if (!document.getElementById("tutorial-backdrop").hidden) {
      positionCurrentTutorialStep();
    }
  });
}

function trapTutorialFocus(event) {
  const tooltip = document.getElementById("tutorial-tooltip");
  const focusable = Array.from(tooltip.querySelectorAll("button")).filter(
    (btn) => !btn.hidden && !btn.disabled
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function startTutorial() {
  document.getElementById("tutorial-backdrop").hidden = false;
  document.getElementById("tutorial-tooltip").hidden = false;
  renderTutorialStep(0);
}

function renderTutorialStep(index) {
  clearTutorialHighlight();
  tutorialStepIndex = index;
  const step = TUTORIAL_STEPS[index];

  if (step.tabToActivate) {
    document.getElementById(`tabbtn-${step.tabToActivate}`).click();
  }

  document.getElementById("tutorial-step-count").textContent = `Step ${index + 1} of ${TUTORIAL_STEPS.length}`;
  document.getElementById("tutorial-title").textContent = step.title;
  document.getElementById("tutorial-desc").textContent = stepDescription(step, identity.grade);

  const backBtn = document.getElementById("tutorial-back-btn");
  backBtn.disabled = index === 0;

  const nextBtn = document.getElementById("tutorial-next-btn");
  nextBtn.textContent = index === TUTORIAL_STEPS.length - 1 ? "Finish" : "Next";

  const targetEl = getEffectiveTutorialTarget(step);
  if (targetEl) {
    targetEl.classList.add("tutorial-highlight");
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  requestAnimationFrame(() => positionCurrentTutorialStep());

  nextBtn.focus();
}

function getEffectiveTutorialTarget(step) {
  if (!step.targetSelector) return null;
  const menuOpen = document.getElementById("tabs-menu-list").classList.contains("open");
  if (!menuOpen) {
    return document.getElementById("tabs-menu-toggle");
  }
  return document.querySelector(step.targetSelector);
}

function positionCurrentTutorialStep() {
  const step = TUTORIAL_STEPS[tutorialStepIndex];
  const targetEl = getEffectiveTutorialTarget(step);
  positionTooltip(document.getElementById("tutorial-tooltip"), targetEl);
}

function clearTutorialHighlight() {
  document.querySelectorAll(".tutorial-highlight").forEach((el) => el.classList.remove("tutorial-highlight"));
}

function endTutorial({ markComplete }) {
  clearTutorialHighlight();
  document.getElementById("tutorial-backdrop").hidden = true;
  document.getElementById("tutorial-tooltip").hidden = true;
  if (markComplete) markTutorialComplete();
}

function setUpBackup() {
  const msg = document.getElementById("backup-msg");

  document.getElementById("export-backup-btn").addEventListener("click", () => {
    const backup = buildBackup({ identity, profile, myListIds, documents: allDocuments, courses, activities });
    downloadBackup(backup);
    msg.textContent = "Backup downloaded!";
    setTimeout(() => { msg.textContent = ""; }, 2500);
  });

  const fileInput = document.getElementById("import-backup-file");
  document.getElementById("import-backup-btn").addEventListener("click", () => {
    fileInput.click();
  });
  document.getElementById("welcome-import-btn").addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const backup = parseBackup(text);

      const confirmed = window.confirm(
        "Importing this backup will replace your current profile, identity info, course list, activity list and college list on this device. " +
        "Uploaded document files aren't part of backups, so those won't be affected. Continue?"
      );
      if (!confirmed) return;

      saveIdentity(backup.identity);
      saveProfile(backup.profile);
      saveMyList(backup.myCollegeListIds);
      saveCourses(backup.courses);
      saveActivities(backup.activities);

      window.location.reload();
    } catch (err) {
      console.error("Failed to import backup:", err);
      msg.textContent = err.message || "Could not read that backup file.";
      setTimeout(() => { msg.textContent = ""; }, 4000);
    }
  });
}

function setUpSearch() {
  const input = document.getElementById("search-input");
  let debounceTimer = null;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshSearchResults, SEARCH_DEBOUNCE_MS);
  });

  document.getElementById("major-filter-toggle").addEventListener("change", refreshSearchResults);
  document.getElementById("search-sort").addEventListener("change", refreshSearchResults);
}

function renderMajorAutocomplete() {
  majorCombobox.setOptions(majorsData.majors.map((major) => ({ value: major.name, keywords: major.aliases })));
}

function updateCurrentMajor({ resetToggle }) {
  currentMajor = findMajor(majorsData, identity.major);

  const toggle = document.getElementById("major-filter-toggle");
  const toggleLabel = document.getElementById("major-filter-label");
  const toggleText = document.getElementById("major-filter-text");
  const sortSelect = document.getElementById("search-sort");
  const sizeOption = sortSelect.querySelector('option[value="majorSize"]');
  const hint = document.getElementById("major-filter-hint");

  toggle.disabled = !currentMajor;
  toggleLabel.classList.toggle("disabled", !currentMajor);
  sizeOption.disabled = !currentMajor;
  if (resetToggle) toggle.checked = Boolean(currentMajor);
  if (!currentMajor) {
    toggle.checked = false;
    if (sortSelect.value === "majorSize") sortSelect.value = "name";
  }

  if (currentMajor) {
    const fieldNames = currentMajor.fields.map((field) => majorsData.fields[field]).join(" or ");
    toggleText.textContent = `Only colleges that offer my major (${currentMajor.name})`;
    hint.textContent =
      `${currentMajor.name} is matched to the federal field group ${fieldNames}. ` +
      (currentMajor.note ? `${currentMajor.note} ` : "") +
      "Field groups are broad, so check each college's website for your exact major. " +
      "\"Bigger program\" means more graduates in that field — it doesn't measure quality.";
  } else if (identity.major && majorsData) {
    toggleText.textContent = "Only colleges with my major";
    hint.textContent = `We couldn't match "${identity.major}" to a field of study. Use Edit profile and pick a major from the suggestions to filter by major.`;
  } else {
    toggleText.textContent = "Only colleges with my major";
    hint.textContent = "Add an intended major with Edit profile (top of the page) to filter and sort by major.";
  }
}

function refreshSearchResults() {
  renderSearchResults(filterAndSortColleges(allColleges, {
    term: document.getElementById("search-input").value,
    major: currentMajor,
    onlyMyMajor: document.getElementById("major-filter-toggle").checked,
    sortBy: document.getElementById("search-sort").value
  }));
}

function renderSearchResults(matches) {
  const list = document.getElementById("search-results");
  const truncatedHint = document.getElementById("search-truncated-hint");
  list.innerHTML = "";

  if (matches.length === 0) {
    truncatedHint.hidden = true;
    list.innerHTML = '<li class="hint">No colleges matched your search.</li>';
    return;
  }

  const shown = matches.slice(0, MAX_SEARCH_RESULTS);

  if (matches.length > MAX_SEARCH_RESULTS) {
    truncatedHint.hidden = false;
    truncatedHint.textContent = `Showing the first ${MAX_SEARCH_RESULTS} of ${matches.length} matches — keep typing to narrow it down.`;
  } else {
    truncatedHint.hidden = true;
  }

  shown.forEach((college) => {
    const inList = myListIds.includes(college.id);
    list.appendChild(buildCollegeCard(college, {
      showChance: false,
      actionLabel: inList ? "Remove from My List" : "Add to My List",
      onAction: () => toggleMyList(college.id)
    }));
  });
}

function toggleMyList(collegeId) {
  if (myListIds.includes(collegeId)) {
    myListIds = myListIds.filter((id) => id !== collegeId);
  } else {
    myListIds.push(collegeId);
  }
  saveMyList(myListIds);

  refreshSearchResults();
  renderMyList();
  renderDocumentCheckboxes();
}

function renderMyList() {
  const list = document.getElementById("mylist-results");
  const emptyHint = document.getElementById("mylist-empty-hint");
  list.innerHTML = "";

  const colleges = myListIds
    .map((id) => findCollegeById(allColleges, id))
    .filter((college) => college !== null);

  emptyHint.style.display = colleges.length === 0 ? "block" : "none";

  colleges.forEach((college) => {
    list.appendChild(buildCollegeCard(college, {
      showChance: true,
      showDocs: true,
      actionLabel: "Remove",
      onAction: () => toggleMyList(college.id)
    }));
  });
  renderDashboard();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function buildCollegeCard(college, { showChance, showDocs, actionLabel, onAction }) {
  const li = document.createElement("li");
  li.className = "college-card";

  const satRange = college.satLo && college.satHi ? `${college.satLo}&ndash;${college.satHi}` : "n/a";
  const actRange = college.actLo && college.actHi ? `${college.actLo}&ndash;${college.actHi}` : "n/a";
  const admitPct = typeof college.admitRate === "number" ? `${Math.round(college.admitRate * 100)}%` : "n/a";

  let chanceHtml = "";
  if (showChance) {
    const chance = getChance(profile, college, { gpaApplies: hasGpaYet(identity.grade) });
    if (chance.label) {
      const badgeClass = `badge-${chance.label.toLowerCase()}`;
      li.classList.add(`card-${chance.label.toLowerCase()}`);
      chanceHtml = `
        <span class="badge ${badgeClass}">${chance.label}</span>
        <p class="reason">${escapeHtml(chance.reason)}</p>
        <p class="note">${chance.note}</p>
      `;
    } else {
      chanceHtml = `<span class="chance-pending">${escapeHtml(chance.reason)}</span>`;
    }
  }

  const majorText = currentMajor ? describeMajorFit(majorFit(college, currentMajor), majorsData.fields) : null;
  const majorHtml = majorText ? `<p class="major-fit">${escapeHtml(majorText)}</p>` : "";

  li.innerHTML = `
    <h3>${college.name}</h3>
    <p class="college-meta">${college.city}, ${college.state} &middot; Admit rate: ${admitPct} &middot; SAT: ${satRange} &middot; ACT: ${actRange}</p>
    ${majorHtml}
    ${chanceHtml}
    <div class="card-actions"></div>
  `;

  const actionBtn = document.createElement("button");
  actionBtn.textContent = actionLabel;
  actionBtn.addEventListener("click", onAction);
  li.querySelector(".card-actions").appendChild(actionBtn);

  if (showDocs) {
    li.appendChild(buildCollegeDocsSection(college));
  }

  return li;
}

function setUpDocumentsForm() {
  const typeSelect = document.getElementById("doc-type");
  DOC_TYPES.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    typeSelect.appendChild(option);
  });

  const form = document.getElementById("documents-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fileInput = document.getElementById("doc-file");
    const file = fileInput.files[0];
    const msg = document.getElementById("doc-upload-msg");

    if (!file) {
      msg.textContent = "Choose a file first.";
      return;
    }
    if (!isAllowedFileType(file)) {
      msg.textContent = "Please upload a PDF, Word document, or image file.";
      return;
    }

    const collegeIds = Array.from(
      document.querySelectorAll('#doc-college-checkboxes input[type="checkbox"]:checked')
    ).map((checkbox) => parseInt(checkbox.value, 10));

    try {
      await addDocument({ file, docType: typeSelect.value, collegeIds });
      allDocuments = await getAllDocuments();
      form.reset();
      renderDocumentCheckboxes();
      msg.textContent = "Uploaded!";
      renderDocumentsList();
      renderMyList();
    } catch (err) {
      console.error("Failed to save document:", err);
      msg.textContent = "Could not save that file — it may be too large for your browser's storage.";
    }

    setTimeout(() => { msg.textContent = ""; }, 3000);
  });

  document.getElementById("doc-select-all-btn").addEventListener("click", () => {
    const checkboxes = document.querySelectorAll('#doc-college-checkboxes input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every((checkbox) => checkbox.checked);
    checkboxes.forEach((checkbox) => { checkbox.checked = !allChecked; });
    updateSelectAllButtonLabel();
  });
}

function renderDocumentCheckboxes() {
  const container = document.getElementById("doc-college-checkboxes");
  const selectAllBtn = document.getElementById("doc-select-all-btn");
  container.innerHTML = "";

  const colleges = myListIds
    .map((id) => findCollegeById(allColleges, id))
    .filter((college) => college !== null);

  if (colleges.length === 0) {
    container.innerHTML = '<p class="hint" id="doc-no-colleges-hint">Add colleges to My College List first to link documents to them.</p>';
    selectAllBtn.hidden = true;
    return;
  }

  selectAllBtn.hidden = false;
  selectAllBtn.textContent = "Select all";

  colleges.forEach((college) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = college.id;
    checkbox.addEventListener("change", updateSelectAllButtonLabel);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(college.name));
    container.appendChild(label);
  });
}

function updateSelectAllButtonLabel() {
  const checkboxes = document.querySelectorAll('#doc-college-checkboxes input[type="checkbox"]');
  if (checkboxes.length === 0) return;
  const allChecked = Array.from(checkboxes).every((checkbox) => checkbox.checked);
  document.getElementById("doc-select-all-btn").textContent = allChecked ? "Clear all" : "Select all";
}

function renderDocumentsList() {
  const list = document.getElementById("documents-list");
  const emptyHint = document.getElementById("documents-empty-hint");
  list.innerHTML = "";

  emptyHint.style.display = allDocuments.length === 0 ? "block" : "none";

  allDocuments.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "doc-card";

    const linkedNames = doc.collegeIds
      .map((id) => findCollegeById(allColleges, id))
      .filter((college) => college !== null)
      .map((college) => college.name);

    li.innerHTML = `
      <span class="doc-type-badge">${escapeHtml(doc.docType)}</span>
      <h3>${escapeHtml(doc.fileName)}</h3>
      <p class="doc-colleges">${linkedNames.length > 0 ? `Linked to: ${escapeHtml(linkedNames.join(", "))}` : "Not linked to any college yet"}</p>
      <div class="doc-actions"></div>
    `;

    const actions = li.querySelector(".doc-actions");

    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", () => downloadDocument(doc));
    actions.appendChild(downloadBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "danger";
    deleteBtn.addEventListener("click", () => removeDocument(doc.id));
    actions.appendChild(deleteBtn);

    list.appendChild(li);
  });
}

async function removeDocument(id) {
  try {
    await deleteDocument(id);
    allDocuments = await getAllDocuments();
    renderDocumentsList();
    renderMyList();
  } catch (err) {
    console.error("Failed to delete document:", err);
  }
}

function buildCollegeDocsSection(college) {
  const section = document.createElement("div");
  section.className = "college-docs";

  const linkedDocs = getDocumentsForCollege(allDocuments, college.id);

  const docsHtml = linkedDocs.length > 0
    ? `<ul class="doc-chip-list">${linkedDocs.map((doc) => `<li class="doc-chip">${escapeHtml(doc.docType)}: ${escapeHtml(doc.fileName)}</li>`).join("")}</ul>`
    : '<p class="hint">No documents linked yet.</p>';

  const haveTypes = new Set(linkedDocs.map((doc) => doc.docType));
  const checklistHtml = CHECKLIST_DOC_TYPES
    .map((type) => `<li class="${haveTypes.has(type) ? "have" : "missing"}">${haveTypes.has(type) ? "✓" : "—"} ${type}</li>`)
    .join("");

  section.innerHTML = `
    <h4>Documents for this college</h4>
    ${docsHtml}
    <ul class="checklist">${checklistHtml}</ul>
  `;

  return section;
}

init();
