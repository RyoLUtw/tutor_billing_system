const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('monthlyView.js', 'utf8');
const start = source.indexOf('    function confirmMissingSchedules(');
const end = source.indexOf("    container.querySelector('#generateMissingSchedulesBtn')", start);
class Element {
  constructor() { this.style = {}; this.children = []; this.nodes = {}; this.events = {}; }
  setAttribute() {}
  querySelector(selector) { return this.nodes[selector] ||= new Element(); }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); }
  addEventListener(name, handler) { this.events[name] = handler; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  remove() { this.removed = true; }
}
function setup(failSave = false) {
  const container = new Element();
  const writes = [];
  const state = vm.createContext({
    document: { createElement: () => new Element() }, container,
    students: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    studentSelect: { value: '0' }, monthlySchedulesByMonth: { '2026-06': { c: [] } },
    generateSchedule: student => [{ date: '2026/06/20', student: student.id }],
    localStorage: { setItem: (key, data) => { if (failSave) throw Error('full'); writes.push(JSON.parse(data)); } },
    renderTable() {}, recalcCharge() {}, currentSchedule: []
  });
  vm.runInContext(source.slice(start, end) + "\nconfirmMissingSchedules('2026-06');", state);
  const dialog = container.children[0];
  const boxes = dialog.querySelector('[data-students]').children.map(label => label.children[0]);
  const submit = () => dialog.querySelector('form').onsubmit({ preventDefault() {} });
  return { state, dialog, boxes, writes, submit };
}
let test = setup();
assert.equal(test.boxes.length, 2, 'existing empty schedule is excluded');
assert.ok(test.boxes.every(box => box.checked));
assert.equal(test.writes.length, 0, 'opening modal does not create schedules');
test.dialog.querySelector('[data-toggle]').onclick();
assert.ok(test.boxes.every(box => !box.checked));
assert.equal(test.dialog.querySelector('[data-confirm]').disabled, true);
test.submit();
assert.equal(test.writes.length, 0);
test.dialog.querySelector('[data-toggle]').onclick();
assert.ok(test.boxes.every(box => box.checked));
test.boxes[0].checked = false;
test.submit();
assert.equal(test.writes.length, 1);
assert.equal(test.state.monthlySchedulesByMonth['2026-06'].a, undefined);
assert.equal(test.state.monthlySchedulesByMonth['2026-06'].b.length, 1);
assert.equal(test.state.monthlySchedulesByMonth['2026-06'].c.length, 0);
assert.equal(test.state.currentSchedule.length, 0, 'unchecked current student stays empty');
assert.ok(test.dialog.removed);
test = setup();
test.dialog.querySelector('[data-cancel]').onclick();
assert.equal(test.writes.length, 0);
test = setup();
test.dialog.events.cancel({ preventDefault() {} });
assert.equal(test.writes.length, 0);
test = setup();
test.submit();
assert.equal(test.state.currentSchedule.length, 1);
assert.equal(test.state.monthlySchedulesByMonth['2026-06'].b.length, 1);
test = setup(true);
test.submit();
assert.equal(test.state.monthlySchedulesByMonth['2026-06'].a, undefined);
assert.equal(test.dialog.open, true);
assert.match(test.dialog.querySelector('[data-error]').textContent, /Could not save/);
console.log('Missing schedule confirmation tests passed: defaults, toggles, subset creation, cancel/Escape, existing schedules and save failure.');


const deleteStart = source.indexOf('    function openDeleteScheduledClasses()');
const deleteEnd = source.indexOf("    container.querySelector('#deleteScheduledClassesBtn')", deleteStart);
function setupDelete(failSave = false, empty = false) {
  const container = new Element();
  const writes = [];
  const schedule = empty ? [] : [
    { date: '2026/06/20', canceled: false },
    { date: '2026/06/20', canceled: true, makeup: { date: '2026/06/21' } },
    { date: '2026/06/27', canceled: false }
  ];
  const state = vm.createContext({
    document: { createElement: () => new Element() }, container,
    students: [{ id: 'a', name: 'A' }], studentSelect: { value: '0' },
    monthlySchedulesByMonth: { '2026-06': { a: schedule, b: [{ date: '2026/06/20' }] } },
    getManagedMonthInfo: () => ({ monthValue: '2026-06' }),
    localStorage: { setItem: (key, data) => { if (failSave) throw Error('full'); writes.push(JSON.parse(data)); } },
    cancellationPopup: new Element(), timeModifierPopup: new Element(), activeIndex: 1, timeModifierIndex: 1,
    renderTable() {}, recalcCharge() {}, currentSchedule: schedule
  });
  vm.runInContext(source.slice(deleteStart, deleteEnd) + '\nopenDeleteScheduledClasses();', state);
  const dialog = container.children[0];
  const boxes = dialog.querySelector('[data-classes]').children.map(label => label.children[0]);
  return { state, dialog, boxes, writes, submit: () => dialog.querySelector('form').onsubmit({ preventDefault() {} }) };
}
let deletion = setupDelete();
assert.ok(deletion.boxes.every(box => !box.checked));
assert.equal(deletion.dialog.querySelector('[data-confirm]').disabled, true);
deletion.submit();
assert.equal(deletion.writes.length, 0);
deletion.dialog.querySelector('[data-toggle]').onclick();
assert.ok(deletion.boxes.every(box => box.checked));
deletion.dialog.querySelector('[data-toggle]').onclick();
assert.ok(deletion.boxes.every(box => !box.checked));
deletion.boxes[1].checked = true;
deletion.boxes[1].events.change();
assert.equal(deletion.dialog.querySelector('[data-confirm]').disabled, false);
deletion.submit();
assert.equal(deletion.state.currentSchedule.length, 2);
assert.equal(deletion.state.currentSchedule[0].canceled, false, 'same-date classes remain independently selectable');
assert.equal(deletion.state.monthlySchedulesByMonth['2026-06'].b.length, 1);
assert.equal(deletion.state.activeIndex, null);
assert.equal(deletion.writes.length, 1);
deletion = setupDelete();
deletion.dialog.querySelector('[data-toggle]').onclick();
deletion.submit();
assert.equal(deletion.state.monthlySchedulesByMonth['2026-06'].a.length, 0, 'retain saved empty schedule');
deletion = setupDelete();
deletion.boxes[0].checked = true;
deletion.dialog.querySelector('[data-cancel]').onclick();
assert.equal(deletion.writes.length, 0);
assert.equal(deletion.state.currentSchedule.length, 3);
deletion = setupDelete();
deletion.dialog.events.cancel({ preventDefault() {} });
assert.equal(deletion.writes.length, 0);
deletion = setupDelete(true);
deletion.boxes[0].checked = true;
deletion.submit();
assert.equal(deletion.state.currentSchedule.length, 3);
assert.equal(deletion.dialog.open, true);
assert.match(deletion.dialog.querySelector('[data-error]').textContent, /No classes were deleted/);
deletion = setupDelete(false, true);
assert.equal(deletion.dialog.querySelector('[data-toggle]').disabled, true);
assert.equal(deletion.dialog.querySelector('[data-confirm]').disabled, true);
console.log('Class deletion tests passed: selection, toggles, duplicates, cancel/Escape, empty schedules, other students and save failure.');
