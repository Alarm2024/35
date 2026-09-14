"use strict";

// The earn schedule turns desk work into credits by published rule, not by mood.
//
// Discretionary issuance is what makes an "earned only" token look issued at will.
// Every ledger entry must name a reason that exists in this schedule, and the
// credit must equal what the schedule says for that reason.

const fs = require("fs");

const { validateCredit } = require("./memo");

function load(earnPath) {
  if (!fs.existsSync(earnPath)) {
    return { ok: false, error: `missing ${earnPath}`, schedule: null };
  }
  try {
    return { ok: true, schedule: JSON.parse(fs.readFileSync(earnPath, "utf8")) };
  } catch (error) {
    return { ok: false, error: `invalid JSON in ${earnPath}: ${error.message}`, schedule: null };
  }
}

function verify(schedule) {
  const errors = [];

  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
    return { ok: false, errors: ["earn schedule must be an object"] };
  }

  if (typeof schedule.publishedAt !== "string" || schedule.publishedAt.trim() === "") {
    errors.push("earn schedule publishedAt is empty or unset");
  }

  if (!schedule.rules || typeof schedule.rules !== "object" || Array.isArray(schedule.rules)) {
    return { ok: false, errors: errors.concat("earn schedule rules must be an object") };
  }

  const reasons = Object.keys(schedule.rules);
  if (reasons.length === 0) {
    errors.push("earn schedule has no rules — nothing can be earned yet");
  }

  for (const reason of reasons) {
    const rule = schedule.rules[reason];
    if (!rule || typeof rule !== "object") {
      errors.push(`rules.${reason} must be an object`);
      continue;
    }

    const check = validateCredit(rule.credit);
    if (!check.ok) {
      errors.push(`rules.${reason}.credit is invalid: ${check.error}`);
    }

    if (typeof rule.describes !== "string" || rule.describes.trim() === "") {
      errors.push(`rules.${reason}.describes is empty — an unexplained rule is a discretionary rule`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function creditFor(schedule, reason) {
  const rule = schedule && schedule.rules ? schedule.rules[reason] : undefined;
  if (!rule) {
    return { ok: false, error: `reason ${JSON.stringify(reason)} is not in the earn schedule` };
  }
  return { ok: true, credit: rule.credit, describes: rule.describes };
}

module.exports = { load, verify, creditFor };
