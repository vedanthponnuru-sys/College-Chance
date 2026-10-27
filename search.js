let collegesCache = null;

export async function loadColleges() {
  if (collegesCache) return collegesCache;
  const response = await fetch("data/colleges.json");
  if (!response.ok) {
    throw new Error(`Could not load college data (status ${response.status})`);
  }
  const data = await response.json();
  collegesCache = data.colleges || [];
  return collegesCache;
}

export function searchColleges(colleges, term) {
  const query = (term || "").trim().toLowerCase();
  if (!query) return colleges;

  return colleges.filter((college) => {
    const nameMatch = college.name.toLowerCase().includes(query);
    const stateMatch = college.state.toLowerCase() === query;
    return nameMatch || stateMatch;
  });
}

export function findCollegeById(colleges, id) {
  return colleges.find((college) => college.id === id) || null;
}

let majorsCache = null;

export async function loadMajors() {
  if (majorsCache) return majorsCache;
  const response = await fetch("data/majors.json");
  if (!response.ok) {
    throw new Error(`Could not load majors data (status ${response.status})`);
  }
  majorsCache = await response.json();
  return majorsCache;
}

function normalize(text) {
  return (text || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function findMajor(majorsData, typed) {
  const text = normalize(typed);
  if (!text || !majorsData) return null;

  const exact = majorsData.majors.find(
    (major) => normalize(major.name) === text || major.aliases.some((alias) => normalize(alias) === text)
  );
  if (exact) return exact;

  let best = null;
  let bestLength = 0;
  majorsData.majors.forEach((major) => {
    [major.name, ...major.aliases].forEach((candidate) => {
      const word = normalize(candidate);
      if (word.length < 4 || word.length <= bestLength) return;
      const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (pattern.test(text)) {
        best = major;
        bestLength = word.length;
      }
    });
  });
  return best;
}

export function majorFit(college, major) {
  if (!major) return { offered: false, percent: null, parts: [] };

  const parts = major.fields
    .filter((field) => college.m && typeof college.m[field] === "number")
    .map((field) => ({ field, percent: college.m[field] }));
  const offeredWithoutPercent = Boolean(college.mo && major.fields.some((field) => college.mo.includes(field)));

  const percent = parts.length > 0 ? parts.reduce((sum, part) => sum + part.percent, 0) : null;
  return { offered: parts.length > 0 || offeredWithoutPercent, percent, parts };
}

export function describeMajorFit(fit, fieldNames) {
  if (fit.parts.length > 0) {
    const [first, ...rest] = fit.parts;
    let text = `${first.percent}% of graduates major in ${fieldNames[first.field]}`;
    rest.forEach((part) => {
      text += ` and ${part.percent}% in ${fieldNames[part.field]}`;
    });
    return `${text}.`;
  }
  if (fit.offered) {
    return "Offers your major (share of graduates not reported for this school).";
  }
  return null;
}

function compareByName(a, b) {
  return a.name.localeCompare(b.name);
}

function compareByAdmitRate(a, b) {
  const aRate = typeof a.admitRate === "number" ? a.admitRate : Infinity;
  const bRate = typeof b.admitRate === "number" ? b.admitRate : Infinity;
  return aRate - bRate || compareByName(a, b);
}

function compareByMajorSize(major) {
  const score = (college) => {
    const fit = majorFit(college, major);
    if (fit.percent !== null) return fit.percent;
    return fit.offered ? -1 : -2;
  };
  return (a, b) => score(b) - score(a) || compareByName(a, b);
}

export function filterAndSortColleges(colleges, { term, major, onlyMyMajor, sortBy }) {
  let results = searchColleges(colleges, term);

  if (major && onlyMyMajor) {
    results = results.filter((college) => majorFit(college, major).offered);
  }

  if (sortBy === "admitRate") {
    results = [...results].sort(compareByAdmitRate);
  } else if (sortBy === "majorSize" && major) {
    results = [...results].sort(compareByMajorSize(major));
  } else {
    results = [...results].sort(compareByName);
  }

  return results;
}
