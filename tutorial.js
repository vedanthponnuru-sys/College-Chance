const TUTORIAL_KEY = "collegeChance.tutorialCompleted";

export const TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Welcome to College Chance!",
    description: "Here's a 60-second tour of the app. Use Next and Back to move around, or Skip at any time.",
    targetSelector: null,
    tabToActivate: "dashboard"
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Your home screen: your career goal, how much of your core plan is done, upcoming milestones, your 4-year roadmap and your next steps.",
    targetSelector: "#tabbtn-dashboard",
    tabToActivate: "dashboard"
  },
  {
    id: "profile",
    title: "My Profile",
    description: (grade) => (typeof grade === "number" && grade >= 10
      ? "Enter your GPA, SAT or ACT score and home state here. It's saved right in your browser — no account needed. You can also export a backup from this tab."
      : "Add your home state, plus test scores if you have any. GPA shows up here starting in 10th grade. It's saved right in your browser — no account needed."),
    targetSelector: "#tabbtn-profile",
    tabToActivate: "profile"
  },
  {
    id: "courses",
    title: "My Courses",
    description: "Log courses you've completed, are taking now, or plan to take. You'll get suggested courses, and your AP/IB/Honors count is calculated automatically.",
    targetSelector: "#tabbtn-courses",
    tabToActivate: "courses"
  },
  {
    id: "activities",
    title: "My Activities",
    description: "Log clubs, sports, jobs, service and family responsibilities, with hours and roles. You'll get ideas for strengthening them based on your grade and major.",
    targetSelector: "#tabbtn-activities",
    tabToActivate: "activities"
  },
  {
    id: "search",
    title: "Search Colleges",
    description: "Look up any of 2,600+ real US colleges by name or state, see admit rates and SAT/ACT ranges, and filter to colleges that offer your major.",
    targetSelector: "#tabbtn-search",
    tabToActivate: "search"
  },
  {
    id: "mylist",
    title: "My College List",
    description: "Add colleges from search to build your list. Each one shows a Reach, Target or Safety label based on your profile, with a one-sentence reason.",
    targetSelector: "#tabbtn-mylist",
    tabToActivate: "mylist"
  },
  {
    id: "documents",
    title: "My Documents",
    description: "Upload your transcript, resume, essays and more, then link each one to colleges on your list.",
    targetSelector: "#tabbtn-documents",
    tabToActivate: "documents"
  }
];

export function stepDescription(step, grade) {
  return typeof step.description === "function" ? step.description(grade) : step.description;
}

export function hasTutorialCompleted() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "true";
  } catch (err) {
    console.warn("Could not read tutorial state from localStorage:", err);
    return false;
  }
}

export function markTutorialComplete() {
  try {
    localStorage.setItem(TUTORIAL_KEY, "true");
    return true;
  } catch (err) {
    console.warn("Could not save tutorial state to localStorage:", err);
    return false;
  }
}

export function positionTooltip(tooltipEl, targetEl) {
  if (!targetEl) {
    tooltipEl.classList.add("centered");
    tooltipEl.style.top = "";
    tooltipEl.style.left = "";
    return;
  }

  tooltipEl.classList.remove("centered");

  const gap = 12;
  const edgeMargin = 8;
  const targetRect = targetEl.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = targetRect.bottom + gap;
  if (top + tooltipRect.height > viewportHeight - edgeMargin) {
    top = targetRect.top - tooltipRect.height - gap;
  }
  top = Math.max(edgeMargin, Math.min(top, viewportHeight - tooltipRect.height - edgeMargin));

  let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
  left = Math.max(edgeMargin, Math.min(left, viewportWidth - tooltipRect.width - edgeMargin));

  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
}
