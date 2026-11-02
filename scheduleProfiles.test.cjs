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
const preserved = api.apply(exceptions, student, [{ start: '', end: '', profile: changed }]);
assert.equal(preserved['2026-06'].s.length, 3);
assert.equal(preserved['2026-06'].s[1].makeup.date, '2026-06-22');
assert.equal(api.totals(student, preserved['2026-06'].s).actual, 1230);
assert.equal(api.totals(student, preserved['2026-06'].s, false).actual, 930);
assert.equal(api.date('2026/6/2'), '2026-06-02');
console.log('Schedule profile tests passed: preservation, inclusive/open ranges, multiple intervals, latest defaults, billing, weekday rebuilds and exceptions.');

// A two-week update must replace off-weekday sessions regardless of cancellation history.
for (const flags of [
  { canceled: true, violation: true, makeup: null },
  { canceled: false, violation: false, makeup: null },
  { canceled: false, 'time modified': 0.5 }
]) {
  const input = structuredClone(months);
  Object.assign(input['2026-06'].s[1], flags);
  // Reproduce a previous update that changed the snapshot but left the old date.
  input['2026-06'].s[1].profile = { ...changed, classDays: ['Sunday'] };
  const profile = { ...changed, classDays: ['Sunday'] };
  const combined = api.apply(input, student, [{ start: '2026-06-20', end: '2026-06-28', profile }]);
  assert.deepEqual(Array.from(combined['2026-06'].s, i => i.date), ['2026/06/13', '2026/06/21', '2026/06/28']);
  assert.equal(combined['2026-06'].s[1].canceled, false);
  assert.equal(combined['2026-06'].s[1].makeup, null);
  const split = api.apply(input, student, [
    { start: '2026-06-20', end: '2026-06-21', profile },
    { start: '2026-06-27', end: '2026-06-28', profile }
  ]);
  assert.equal(JSON.stringify(combined), JSON.stringify(split));
  assert.equal(JSON.stringify(api.apply(combined, student, [{ start: '2026-06-20', end: '2026-06-28', profile }])), JSON.stringify(combined));
  assert.equal(combined['2026-06'].s[0].date, input['2026-06'].s[0].date);
}
console.log('Cancelled/unmarked session regressions passed: two-week intervals, split intervals and retries.');

for (const flags of [
  { manual: true, 'time modified': 0.5 },
  { manual: true, canceled: true, violation: true, makeup: { date: '2026-06-22', time: '14:00' }, 'time modified': 0.5 },
  { canceled: true, violation: true, makeup: { date: '2026-06-22', time: '14:00' } }
]) {
  const input = structuredClone(months);
  Object.assign(input['2026-06'].s[1], flags);
  const range = { start: '2026-06-20', end: '2026-06-28', profile: { ...changed, classDays: ['Sunday'] } };
  const result = api.apply(input, student, [range]);
  assert.deepEqual(Array.from(result['2026-06'].s, i => i.date), flags.manual
    ? ['2026/06/13', '2026/06/20', '2026/06/21', '2026/06/28']
    : ['2026/06/13', '2026/06/21', '2026/06/28']);
  const kept = result['2026-06'].s[1];
  for (const key of Object.keys(flags)) assert.equal(JSON.stringify(kept[key]), JSON.stringify(flags[key]));
  assert.equal(kept.profile.hourlyRate, 200);
  assert.equal(JSON.stringify(api.apply(result, student, [range])), JSON.stringify(result));
}
const thursdayStudent = { ...student, classDays: ['Thursday'] };
const thursdayMonths = { '2026-06': { s: [
  { ...item('2026/06/11'), canceled: true, violation: true, makeup: { date: '2026-06-10', time: '15:30' } },
  item('2026/06/18')
] } };
const mondayRange = { start: '2026-06-08', end: '2026-06-21', profile: { ...changed, classDays: ['Monday'] } };
const mondays = api.apply(thursdayMonths, thursdayStudent, [mondayRange]);
assert.deepEqual(Array.from(mondays['2026-06'].s, i => i.date), ['2026/06/08', '2026/06/15']);
assert.equal(mondays['2026-06'].s[0].makeup.date, '2026-06-10');
assert.equal(mondays['2026-06'].s[0].makeup.time, '15:30');
assert.equal(mondays['2026-06'].s[0].canceled, true);
assert.equal(mondays['2026-06'].s[1].canceled, false);
assert.throws(() => api.apply(thursdayMonths, thursdayStudent, [{ ...mondayRange, profile: { ...changed, classDays: [] } }]), /No replacement date/);
assert.equal(thursdayMonths['2026-06'].s[0].date, '2026/06/11');
console.log('Manual exceptions and Thursday-to-Monday rescheduling with Wednesday make-up preserved passed.');

const addedCancelled = structuredClone(thursdayMonths);
addedCancelled['2026-06'].s[0].manual = true;
const addedResult = api.apply(addedCancelled, thursdayStudent, [mondayRange]);
const originalAdded = addedResult['2026-06'].s.find(session => session.manual);
assert.equal(originalAdded.date, '2026/06/11');
assert.equal(originalAdded.canceled, true);
assert.equal(originalAdded.makeup.date, '2026-06-10');
assert.equal(originalAdded.makeup.time, '15:30');
assert.equal(addedResult['2026-06'].s.find(session => session.date === '2026/06/08').makeup, null);
console.log('Cancelled manually added classes and their make-up arrangements stay on their original dates.');
