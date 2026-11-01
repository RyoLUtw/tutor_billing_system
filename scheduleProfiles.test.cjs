const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('scheduleProfiles.js', 'utf8') + '\nthis.api = scheduleProfiles;', context);
const api = context.api;
const student = { id: 's', name: 'Student', classDays: ['Saturday'], sessionLength: 1, hourlyRate: 100, additionalChargeModifier: 10 };
const item = date => ({ date, canceled: false, violation: false, makeup: null, 'time modified': 0 });
const months = { '2026-06': { s: [item('2026/06/13'), item('2026/06/20'), item('2026/06/27')], other: [item('2026/06/20')] } };
const changed = { ...student, hourlyRate: 200, additionalChargeModifier: 30 };
const keep = api.apply(months, student, []);
assert.equal(api.totals(changed, keep['2026-06'].s).actual, 310);
assert.equal(months['2026-06'].s[0].profile, undefined, 'input remains untouched');
const after = api.apply(months, student, [{ start: '2026-06-20', end: '', profile: changed }]);
assert.deepEqual(Array.from(after['2026-06'].s, i => i.profile.hourlyRate), [100, 200, 200]);
assert.equal(api.totals(student, after['2026-06'].s).actual, 530);
const before = api.apply(months, student, [{ start: '', end: '2026-06-20', profile: changed }]);
assert.deepEqual(Array.from(before['2026-06'].s, i => i.profile.hourlyRate), [200, 200, 100]);
assert.equal(api.latest(student, [...before['2026-06'].s].reverse()).hourlyRate, 100);
const multiple = api.apply(months, student, [
  { start: '', end: '2026-06-13', profile: changed },
  { start: '2026-06-27', end: '', profile: { ...changed, hourlyRate: 300 } }
]);
assert.deepEqual(Array.from(multiple['2026-06'].s, i => i.profile.hourlyRate), [200, 100, 300]);
assert.equal(api.latest(student, multiple['2026-06'].s).hourlyRate, 300);
assert.equal(multiple['2026-06'].other[0].profile, undefined);
const all = api.apply(months, student, [{ start: '', end: '', profile: changed }]);
assert.equal(api.totals(student, all['2026-06'].s).actual, 630);
const weekday = api.apply(months, student, [{ start: '2026-06-20', end: '', profile: { ...changed, classDays: ['Sunday'] } }]);
assert.deepEqual(Array.from(weekday['2026-06'].s, i => i.date), ['2026/06/13', '2026/06/21', '2026/06/28']);
const exceptions = structuredClone(months);
Object.assign(exceptions['2026-06'].s[1], { canceled: true, violation: true, makeup: { date: '2026-06-22' }, 'time modified': 0.5 });
const preserved = api.apply(exceptions, student, [{ start: '', end: '', profile: { ...changed, classDays: [] } }]);
assert.equal(preserved['2026-06'].s.length, 1);
assert.equal(preserved['2026-06'].s[0].makeup.date, '2026-06-22');
assert.equal(api.totals(student, preserved['2026-06'].s).actual, 830);
assert.equal(api.totals(student, preserved['2026-06'].s, false).actual, 530);
assert.equal(api.date('2026/6/2'), '2026-06-02');
console.log('Schedule profile tests passed: preservation, inclusive/open ranges, multiple intervals, latest defaults, billing, weekday rebuilds and exceptions.');
