const { RRule, RRuleSet, rrulestr } = require('rrule');

function parseDateTime(dateStr, timeStr){
  // dateStr expected mm/dd/yyyy or yyyy-mm-dd; timeStr expected like hh:mm or hh:mm AM/PM
  // Try Date constructor on combined string first
  const combined = `${dateStr} ${timeStr}`;
  const dt = new Date(combined);
  if(!isNaN(dt)) return dt;

  // Try more explicit parsing for mm/dd/yyyy
  const dateParts = dateStr.split('/');
  if(dateParts.length === 3){
    const [m,d,y] = dateParts.map(p=>Number(p));
    // parse time
    const t = parseTimeTo24(timeStr);
    return new Date(y, m-1, d, t.h, t.m);
  }

  throw new Error('Unable to parse date/time');
}

function parseTimeTo24(tstr){
  // handles `hh:mm` or `hh:mm AM/PM`
  const m = tstr.trim().match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm))?/);
  if(!m) return {h:0,m:0};
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[3];
  if(ampm){
    const up = ampm.toUpperCase();
    if(up === 'PM' && h < 12) h += 12;
    if(up === 'AM' && h === 12) h = 0;
  }
  return {h, m: min};
}

function computeNextOccurrences(dtstart, ruleInput, limit=10){
  // ruleInput may be a string (RFC rrule) or an object
  let rule;
  if(!ruleInput) return [];
  if(typeof ruleInput === 'string'){
    rule = rrulestr(ruleInput);
  } else if(ruleInput && typeof ruleInput === 'object' && ruleInput.freq){
    const opts = Object.assign({}, ruleInput);
    opts.dtstart = dtstart;
    rule = new RRule(opts);
  } else {
    throw new Error('Invalid rule input');
  }

  return rule.all((date, i) => i < limit);
}

module.exports = { parseDateTime, computeNextOccurrences };
