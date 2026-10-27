const IDENTITY_KEY = "collegeChance.identity";

function blankIdentity() {
  return {
    firstName: "",
    lastName: "",
    grade: null,
    highSchool: "",
    gradYear: null,
    major: ""
  };
}

export function loadIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return blankIdentity();
    const parsed = JSON.parse(raw);
    return { ...blankIdentity(), ...parsed };
  } catch (err) {
    console.warn("Could not load identity from localStorage:", err);
    return blankIdentity();
  }
}

export function saveIdentity(identity) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    return true;
  } catch (err) {
    console.warn("Could not save identity to localStorage:", err);
    return false;
  }
}

export function hasIdentity(identity) {
  return Boolean(identity && identity.firstName);
}

export function gradYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear; year <= currentYear + 5; year++) {
    years.push(year);
  }
  return years;
}

export function buildBackup({ identity, profile, myListIds, documents, courses, activities }) {
  return {
    appName: "College Chance",
    version: 3,
    exportedAt: new Date().toISOString(),
    identity,
    profile,
    myCollegeListIds: myListIds,
    courses: courses || [],
    activities: activities || [],
    documents: documents.map((doc) => ({
      fileName: doc.fileName,
      fileType: doc.fileType,
      docType: doc.docType,
      collegeIds: doc.collegeIds,
      uploadedAt: doc.uploadedAt
    })),
    note: "This backup does not include the actual uploaded document files — only a record of what was uploaded (name, type, and which colleges it was linked to). Re-upload files after importing if you need them back."
  };
}

export function downloadBackup(backup) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStr = backup.exportedAt.slice(0, 10);

  const link = document.createElement("a");
  link.href = url;
  link.download = `college-chance-backup-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseBackup(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    throw new Error("That file isn't valid JSON.");
  }

  if (
    !data ||
    typeof data !== "object" ||
    typeof data.identity !== "object" ||
    typeof data.profile !== "object" ||
    !Array.isArray(data.myCollegeListIds)
  ) {
    throw new Error("That doesn't look like a College Chance backup file.");
  }

  if (!Array.isArray(data.courses)) {
    data.courses = [];
  }

  if (!Array.isArray(data.activities)) {
    data.activities = [];
  }

  return data;
}
