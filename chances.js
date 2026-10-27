const NOTE =
  "This is an estimate based on public data. Admissions also weighs essays, " +
  "recommendations and context this app can't see.";

function scoreFit(profile, college) {
  const studentScore = profile.sat || (profile.act ? convertActToSat(profile.act) : null);
  if (!studentScore) return null;

  const lo = college.satLo;
  const hi = college.satHi;
  if (!lo || !hi) return null;

  if (studentScore > hi) return "strong";
  if (studentScore >= lo) return "in range";
  return "below range";
}

function convertActToSat(act) {
  const table = {
    36: 1570, 35: 1530, 34: 1490, 33: 1460, 32: 1430, 31: 1400,
    30: 1370, 29: 1340, 28: 1310, 27: 1280, 26: 1240, 25: 1210,
    24: 1180, 23: 1140, 22: 1110, 21: 1080, 20: 1040, 19: 1000,
    18: 960, 17: 920, 16: 880, 15: 830
  };
  return table[act] || null;
}

function scoreDescription(profile) {
  if (profile.sat) return `Your SAT of ${profile.sat}`;
  if (profile.act) return `Your ACT of ${profile.act}`;
  return null;
}

export const NO_DATA_MESSAGE = "Add test scores to see your estimate";

export function getChance(profile, college, { gpaApplies = true } = {}) {
  const hasScore = Boolean(profile.sat || profile.act);
  const hasGpa = gpaApplies && typeof profile.gpa === "number";
  if (!hasScore && !hasGpa) {
    return { label: null, reason: NO_DATA_MESSAGE, note: NOTE };
  }

  const fit = scoreFit(profile, college);
  const admitRate = college.admitRate;

  const scoreNote = scoreDescription(profile);

  if (typeof admitRate === "number" && admitRate < 0.20) {
    const fitWord = fit === "strong" ? "well above" : fit === "in range" ? "within" : "below";
    return {
      label: "Reach",
      reason: scoreNote && fit
        ? `${scoreNote} is ${fitWord} this school's typical range${fit === "below range" ? ", and" : ", but"} it admits under 20% of applicants, so it's a reach for every student.`
        : `${college.name} admits under 20% of applicants, so it's a reach for every student.`,
      note: NOTE
    };
  }

  if (typeof admitRate === "number" && admitRate > 0.50 && (fit === "in range" || fit === "strong")) {
    return {
      label: "Safety",
      reason: `${scoreNote} is ${fit === "strong" ? "above" : "within"} this school's typical range, and it admits over half of applicants, so this should be a safety.`,
      note: NOTE
    };
  }

  if (fit === "strong") {
    return {
      label: "Safety",
      reason: `${scoreNote} is above this school's typical admitted range, making it likely a safety.`,
      note: NOTE
    };
  }
  if (fit === "in range") {
    return {
      label: "Target",
      reason: `${scoreNote} falls within this school's typical admitted range, making it a solid target.`,
      note: NOTE
    };
  }
  if (fit === "below range") {
    return {
      label: "Reach",
      reason: `${scoreNote} is below this school's typical admitted range, making it a reach.`,
      note: NOTE
    };
  }

  if (typeof admitRate === "number") {
    const missingCollegeData = Boolean(scoreNote);

    if (admitRate > 0.50) {
      return {
        label: "Safety",
        reason: missingCollegeData
          ? `${college.name} doesn't report SAT/ACT data to compare your score against, but it admits over half of applicants, so this looks like a safety.`
          : `${college.name} admits over half of applicants, so without a test score to compare, it looks like a safety.`,
        note: NOTE
      };
    }
    return {
      label: "Target",
      reason: missingCollegeData
        ? `${college.name} doesn't report SAT/ACT data to compare your score against, so this is a rough estimate based on admission rate alone.`
        : `There isn't enough score data to compare, so this is a rough estimate based on admission rate alone.`,
      note: NOTE
    };
  }

  return {
    label: "Target",
    reason: `Not enough data on this college to estimate confidently — treat this as a placeholder.`,
    note: NOTE
  };
}
