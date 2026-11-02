// views/monthlyView.js
const monthlyView = {
  render: function (rootElement, { students }) {
    // 1) Load existing monthly schedules from localStorage (if any)
    const schedulesData = localStorage.getItem('monthlySchedulesByMonth');
    let monthlySchedulesByMonth = schedulesData ? JSON.parse(schedulesData) : {};
    /*
       Expected structure (unchanged):
       {
         "2025-01": {
           "student_abc": [ 
             { date, canceled, violation, makeup, "time modified": <number> }, 
             ... 
           ],
           "student_xyz": [ ... ]
         },
         "2025-02": { ... }
       }
    */

    // 2) Build our DOM
    // (Note: temporary modifier input and print buttons removed)
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Monthly Charge Summary</h1>
      <div>
        <label>Select Student:</label>
        <select id="studentSelect"></select>
      </div>
      <div>
        <label>Month (1-12):</label>
        <input type="number" id="monthInput" min="1" max="12" />
        <label>Year (e.g., 2025):</label>
        <input type="number" id="yearInput" />
      </div>

      <h2>Scheduled Classes</h2>
      <table id="datesTable" border="1">
        <thead>
          <tr>
            <th>Date</th>
            <th>Cancellation Status</th>
            <th>Make-up Class</th>
            <th>調整時數</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>

      <div>
        <button id="addScheduledClassBtn">Add New Scheduled Class</button>
        <button id="generateMissingSchedulesBtn" type="button">Create Missing Schedules</button>
        <button id="deleteScheduledClassesBtn" type="button">Delete Scheduled Classes</button>
      </div>

      <!-- Summary section without temporary modifier input -->
      <h2>Summary</h2>
      <div>
        <p>Scheduled Classes: <span id="scheduledCountDisplay">0</span></p>
        <p>Cancelled Classes: <span id="canceledCountDisplay">0</span></p>
        <p>Make-Up Classes: <span id="makeupCountDisplay">0</span></p>
        <p>Profile Modifier: <span id="profileModifierDisplay">0</span></p>
      </div>

      <h3>Total Charge: <span id="totalChargeDisplay">0</span></h3>
      <button id="updateChargeBtn">Update Charge</button>
      
      <!-- Removed "Print This Student’s Charge" and "Batch Print All Students" buttons -->

      <hr />

      <h2>Backup / Restore / Clear</h2>
      <div>
        <button id="downloadJsonBtn">Download All Schedules as JSON</button>
        <input type="file" id="uploadJsonInput" accept=".json" style="display:none" />
        <button id="uploadJsonBtn">Upload JSON</button>
        <button id="clearLocalStorageBtn">Clear Local Storage</button>
      </div>

      <!-- Popup for marking cancellation -->
      <div id="cancellationPopup" style="
          display:none; 
          position:absolute; 
          background-color:#eee; 
          border:1px solid #000; 
          padding:10px;
          z-index:9999;">
        <h3>Cancellation Details</h3>
        <label>
          Violation of Cancellation Policy?
          <input type="checkbox" id="violationCheckbox" />
        </label>
        <br/>
        <label>
          Arranged Make-up Class?
          <input type="checkbox" id="makeupCheckbox" />
        </label>
        <br/>
        <div id="makeupDetails" style="display:none;">
          <label>Make-up Date:</label>
          <input type="date" id="makeupDateInput" />
          <label>Start Time:</label>
          <input type="time" id="makeupTimeInput" />
        </div>
        <br/>
        
        <button id="saveCancellationBtn">Save</button>
        <button id="closePopupBtn">Close</button>
      </div>

      <!-- New Popup for modifying session time -->
      <div id="timeModifierPopup" style="
          display:none; 
          position:absolute; 
          background-color:#eef; 
          border:1px solid #000; 
          padding:10px;
          z-index:9999;">
        <h3>Modify Session Time (hours)</h3>
        <input type="number" id="timeModifierInput" step="0.1" value="0" />
        <br/>
        <button id="saveTimeModifierBtn">Save</button>
        <button id="cancelTimeModifierBtn">Cancel</button>
      </div>

      <div id="addScheduledClassModal" style="
          display:none;
          position:fixed;
          inset:0;
          background:rgba(15,23,42,0.45);
          z-index:10000;
          align-items:center;
          justify-content:center;
          padding:16px;">
        <div style="
            width:min(92vw,560px);
            max-height:calc(100vh - 32px);
            overflow:auto;
            background:#fff;
            border:1px solid #b9c6d6;
            border-radius:8px;
            padding:18px;
            box-shadow:0 20px 50px rgba(15,23,42,0.22);">
          <h3>Add New Scheduled Class</h3>
          <p id="addClassMonthHint" style="margin:0 0 12px;"></p>
          <div>
            <label>Date:</label>
            <input type="date" id="addClassDateInput" />
            <button id="addClassDateBtn">Add Date</button>
          </div>
          <div id="selectedClassDates" style="margin:10px 0;"></div>
          <div>
            <label>Length of Session (hours):</label>
            <input type="number" id="addClassLengthInput" min="0.1" step="0.1" />
          </div>
          <p id="addClassValidationMsg" style="color:#b42318; min-height:1.5em;"></p>
          <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
            <button id="confirmAddClassBtn">Confirm</button>
            <button id="cancelAddClassBtn">Cancel</button>
          </div>
        </div>
      </div>
    `;
    rootElement.appendChild(container);

    // 3) References
    const studentSelect = container.querySelector('#studentSelect');
    const monthInput = container.querySelector('#monthInput');
    const yearInput = container.querySelector('#yearInput');
    const datesTableBody = container.querySelector('#datesTable tbody');
    const scheduledCountDisplay = container.querySelector('#scheduledCountDisplay');
    const canceledCountDisplay = container.querySelector('#canceledCountDisplay');
    const makeupCountDisplay = container.querySelector('#makeupCountDisplay');
    const profileModifierDisplay = container.querySelector('#profileModifierDisplay');
    const totalChargeDisplay = container.querySelector('#totalChargeDisplay');
    const updateChargeBtn = container.querySelector('#updateChargeBtn');
    const addScheduledClassBtn = container.querySelector('#addScheduledClassBtn');
    const downloadJsonBtn = container.querySelector('#downloadJsonBtn');
    const uploadJsonBtn = container.querySelector('#uploadJsonBtn');
    const uploadJsonInput = container.querySelector('#uploadJsonInput');
    const clearLocalStorageBtn = container.querySelector('#clearLocalStorageBtn');
    const cancellationPopup = container.querySelector('#cancellationPopup');
    const violationCheckbox = container.querySelector('#violationCheckbox');
    const makeupCheckbox = container.querySelector('#makeupCheckbox');
    const makeupDetails = container.querySelector('#makeupDetails');
    const makeupDateInput = container.querySelector('#makeupDateInput');
    const makeupTimeInput = container.querySelector('#makeupTimeInput');
    const saveCancellationBtn = container.querySelector('#saveCancellationBtn');
    const closePopupBtn = container.querySelector('#closePopupBtn');
    const timeModifierPopup = container.querySelector('#timeModifierPopup');
    const timeModifierInput = container.querySelector('#timeModifierInput');
    const saveTimeModifierBtn = container.querySelector('#saveTimeModifierBtn');
    const cancelTimeModifierBtn = container.querySelector('#cancelTimeModifierBtn');
    const addScheduledClassModal = container.querySelector('#addScheduledClassModal');
    const addClassMonthHint = container.querySelector('#addClassMonthHint');
    const addClassDateInput = container.querySelector('#addClassDateInput');
    const addClassDateBtn = container.querySelector('#addClassDateBtn');
    const selectedClassDates = container.querySelector('#selectedClassDates');
    const addClassLengthInput = container.querySelector('#addClassLengthInput');
    const addClassValidationMsg = container.querySelector('#addClassValidationMsg');
    const confirmAddClassBtn = container.querySelector('#confirmAddClassBtn');
    const cancelAddClassBtn = container.querySelector('#cancelAddClassBtn');

    // We'll keep the schedule in the original structure (an array) so that old JSON works.
    let currentSchedule = null; 
    let activeIndex = null;
    let selectedDatesForNewClasses = [];

    // 4) Populate student dropdown
    students.forEach((s, i) => {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = s.name;
      studentSelect.appendChild(option);
    });

    // 5) Default month/year to today
    const today = new Date();
    monthInput.value = today.getMonth() + 1;
    yearInput.value = today.getFullYear();

    // 6) Helper: day string -> number
    function getDayNumber(dayString) {
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return days.findIndex(d => d.toLowerCase() === dayString.toLowerCase());
    }

    function getManagedMonthInfo() {
      const chosenMonth = parseInt(monthInput.value, 10);
      const chosenYear = parseInt(yearInput.value, 10);
      if (!Number.isInteger(chosenMonth) || chosenMonth < 1 || chosenMonth > 12
          || !Number.isInteger(chosenYear) || chosenYear < 1 || chosenYear > 9999) return null;
      const monthValue = `${chosenYear}-${String(chosenMonth).padStart(2, '0')}`;
      const firstDate = `${monthValue}-01`;
      const lastDay = new Date(chosenYear, chosenMonth, 0).getDate();
      const lastDate = `${monthValue}-${String(lastDay).padStart(2, '0')}`;
      const monthName = new Date(chosenYear, chosenMonth - 1, 1).toLocaleString(undefined, {
        month: 'long',
        year: 'numeric'
      });
      return { chosenMonth, chosenYear, monthValue, firstDate, lastDate, monthName };
    }

    function dateInputToScheduleDate(value) {
      return value.replace(/-/g, '/');
    }

    function scheduleDateToDateInput(value) {
      return String(value || '').replace(/\//g, '-');
    }

    function isDateInManagedMonth(value) {
      const monthInfo = getManagedMonthInfo();
      return !!monthInfo && value >= monthInfo.firstDate && value <= monthInfo.lastDate;
    }

    // 7) Generate a new schedule array for a student; then return it (old JSON structure)
    function generateSchedule(student, yearMonth) {
      if (!Array.isArray(student.classDays) || student.classDays.length === 0) {
        return [];
      }
      const [yy, mm] = yearMonth.split('-');
      const monthNum = parseInt(mm, 10);
      const yearNum = parseInt(yy, 10);
      let result = [];
      student.classDays.forEach(dayStr => {
        const dayNum = getDayNumber(dayStr);
        if (dayNum < 0) return;
        let d = new Date(yearNum, monthNum - 1, 1);
        while (d.getMonth() === (monthNum - 1)) {
          if (d.getDay() === dayNum) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            result.push({
              date: `${y}/${m}/${dd}`,
              profile: scheduleProfiles.values(student),
              canceled: false,
              violation: false,
              makeup: null,
              "time modified": 0
            });
          }
          d.setDate(d.getDate() + 1);
        }
      });
      result.sort((a, b) => (a.date > b.date ? 1 : -1));
      return result;
    }

    // Missing schedules are only generated after explicit confirmation.
    function confirmMissingSchedules(yearMonth) {
      const monthMap = monthlySchedulesByMonth[yearMonth] || {};
      const missing = students.filter(student => !Object.prototype.hasOwnProperty.call(monthMap, student.id));
      if (!missing.length) return;
      const dialog = document.createElement('dialog');
      dialog.setAttribute('aria-labelledby', 'createSchedulesTitle');
      dialog.style.cssText = 'width:min(90vw,560px);max-height:85vh;overflow:auto;border:1px solid #b9c6d6;border-radius:10px;padding:24px';
      dialog.innerHTML = `
        <form method="dialog">
          <h2 id="createSchedulesTitle">Create missing schedules</h2>
          <p data-month></p>
          <p>Select students to create schedules using their current defaults. Existing schedules will be kept.</p>
          <button type="button" data-toggle>Select / deselect all</button>
          <fieldset><legend>Students missing schedules</legend><div data-students></div></fieldset>
          <p data-error role="alert" style="color:#b42318"></p>
          <button type="submit" data-confirm>Create selected schedules</button>
          <button type="button" data-cancel>Cancel</button>
        </form>`;
      dialog.querySelector('[data-month]').textContent = `Month: ${yearMonth}`;
      const checkboxes = missing.map(student => {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;gap:8px;margin:10px 0';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        label.append(checkbox, student.name + (student.id === students[studentSelect.value]?.id ? ' (selected student)' : ''));
        dialog.querySelector('[data-students]').appendChild(label);
        return { student, checkbox };
      });
      const toggle = dialog.querySelector('[data-toggle]');
      const confirm = dialog.querySelector('[data-confirm]');
      const refresh = () => {
        toggle.textContent = checkboxes.every(entry => entry.checkbox.checked) ? 'Deselect all' : 'Select all';
        confirm.disabled = !checkboxes.some(entry => entry.checkbox.checked);
      };
      checkboxes.forEach(({ checkbox }) => checkbox.addEventListener('change', refresh));
      toggle.onclick = () => {
        const checked = !checkboxes.every(entry => entry.checkbox.checked);
        checkboxes.forEach(entry => { entry.checkbox.checked = checked; });
        refresh();
      };
      const close = () => { dialog.close(); dialog.remove(); };
      dialog.querySelector('[data-cancel]').onclick = close;
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      dialog.querySelector('form').onsubmit = event => {
        event.preventDefault();
        const selected = checkboxes.filter(entry => entry.checkbox.checked);
        if (!selected.length) return;
        const updatedMap = { ...(monthlySchedulesByMonth[yearMonth] || {}) };
        selected.forEach(({ student }) => {
          if (!Object.prototype.hasOwnProperty.call(updatedMap, student.id)) {
            updatedMap[student.id] = generateSchedule(student, yearMonth);
          }
        });
        const updatedMonths = { ...monthlySchedulesByMonth, [yearMonth]: updatedMap };
        try {
          localStorage.setItem('monthlySchedulesByMonth', JSON.stringify(updatedMonths));
        } catch (error) {
          dialog.querySelector('[data-error]').textContent = 'Could not save schedules. Please try again.';
          return;
        }
        monthlySchedulesByMonth = updatedMonths;
        currentSchedule = updatedMap[students[studentSelect.value]?.id] || [];
        renderTable();
        recalcCharge();
        close();
      };
      refresh();
      container.appendChild(dialog);
      dialog.showModal();
    }

    container.querySelector('#generateMissingSchedulesBtn').addEventListener('click', () => {
      const monthInfo = getManagedMonthInfo();
      if (monthInfo) confirmMissingSchedules(monthInfo.monthValue);
    });

    function openDeleteScheduledClasses() {
      const monthInfo = getManagedMonthInfo();
      const student = students[studentSelect.value];
      if (!monthInfo || !student) return;
      const yearMonth = monthInfo.monthValue;
      const schedule = monthlySchedulesByMonth[yearMonth]?.[student.id] || [];
      const dialog = document.createElement('dialog');
      dialog.setAttribute('aria-labelledby', 'deleteClassesTitle');
      dialog.style.cssText = 'width:min(90vw,620px);max-height:85vh;overflow:auto;border:1px solid #b9c6d6;border-radius:10px;padding:24px';
      dialog.innerHTML = `
        <form method="dialog">
          <h2 id="deleteClassesTitle">Delete scheduled classes</h2>
          <p data-context></p>
          <p>Select the classes to remove, then confirm deletion.</p>
          <button type="button" data-toggle>Select all</button>
          <fieldset><legend>Existing classes</legend><div data-classes></div></fieldset>
          <p data-error role="alert" style="color:#b42318"></p>
          <button type="submit" data-confirm disabled>Delete selected classes</button>
          <button type="button" data-cancel>Cancel</button>
        </form>`;
      dialog.querySelector('[data-context]').textContent = `${student.name} — ${yearMonth}`;
      const list = dialog.querySelector('[data-classes]');
      if (!schedule.length) list.textContent = 'No scheduled classes exist for this student in this month.';
      const checkboxes = schedule.map((item, index) => {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;gap:8px;margin:10px 0';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false;
        const status = item.canceled ? (item.violation ? 'Canceled (compensated)' : 'Canceled') : 'Scheduled';
        const makeup = item.makeup ? `; make-up: ${item.makeup.date} ${item.makeup.time || ''}` : '';
        const adjustment = item['time modified'] ? `; time adjustment: ${item['time modified']} hours` : '';
        label.append(checkbox, `${item.date}${item.manual ? ' — Added class' : ''} — ${status}${makeup}${adjustment}`);
        list.appendChild(label);
        return { index, checkbox };
      });
      const toggle = dialog.querySelector('[data-toggle]');
      const confirm = dialog.querySelector('[data-confirm]');
      const refresh = () => {
        const count = checkboxes.filter(entry => entry.checkbox.checked).length;
        toggle.textContent = count && count === checkboxes.length ? 'Deselect all' : 'Select all';
        toggle.disabled = !checkboxes.length;
        confirm.disabled = !count;
        confirm.textContent = count ? `Delete selected classes (${count})` : 'Delete selected classes';
      };
      checkboxes.forEach(({ checkbox }) => checkbox.addEventListener('change', refresh));
      toggle.onclick = () => {
        const checked = !checkboxes.every(entry => entry.checkbox.checked);
        checkboxes.forEach(entry => { entry.checkbox.checked = checked; });
        refresh();
      };
      const close = () => { dialog.close(); dialog.remove(); };
      dialog.querySelector('[data-cancel]').onclick = close;
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      dialog.querySelector('form').onsubmit = event => {
        event.preventDefault();
        const selected = new Set(checkboxes.filter(entry => entry.checkbox.checked).map(entry => entry.index));
        if (!selected.size) return;
        const remaining = schedule.filter((item, index) => !selected.has(index));
        // Preserve an empty saved schedule so deleted classes are not regenerated.
        const updatedMonths = { ...monthlySchedulesByMonth,
          [yearMonth]: { ...monthlySchedulesByMonth[yearMonth], [student.id]: remaining } };
        try {
          localStorage.setItem('monthlySchedulesByMonth', JSON.stringify(updatedMonths));
        } catch (error) {
          dialog.querySelector('[data-error]').textContent = 'Could not save changes. No classes were deleted. Please try again.';
          return;
        }
        monthlySchedulesByMonth = updatedMonths;
        currentSchedule = remaining;
        cancellationPopup.style.display = 'none';
        timeModifierPopup.style.display = 'none';
        activeIndex = null;
        timeModifierIndex = null;
        renderTable();
        recalcCharge();
        close();
      };
      refresh();
      container.appendChild(dialog);
      dialog.showModal();
    }

    container.querySelector('#deleteScheduledClassesBtn').addEventListener('click', openDeleteScheduledClasses);

    // 8) Load saved schedules; ask before creating missing schedules.
    function loadOrGenerateSchedule() {
      const selectedIndex = studentSelect.value;
      if (selectedIndex === '') {
        currentSchedule = [];
        renderTable();
        recalcCharge();
        return;
      }
      const monthInfo = getManagedMonthInfo();
      if (!monthInfo) {
        currentSchedule = [];
        renderTable();
        recalcCharge();
        return;
      }
      const student = students[selectedIndex];
      const yearMonth = monthInfo.monthValue;
      const monthMap = monthlySchedulesByMonth[yearMonth] || {};
      const exists = Object.prototype.hasOwnProperty.call(monthMap, student.id);
      currentSchedule = exists ? monthMap[student.id] : [];
      renderTable();
      recalcCharge();
      if (!exists) confirmMissingSchedules(yearMonth);
    }


    // 9) Save schedule to localStorage (old structure unchanged)
    function saveMonthlySchedules() {
      localStorage.setItem('monthlySchedulesByMonth', JSON.stringify(monthlySchedulesByMonth));
    }
    function persistCurrentSchedule() {
      const selectedIndex = studentSelect.value;
      if (selectedIndex === '') return;
      const chosenMonth = parseInt(monthInput.value, 10);
      const chosenYear = parseInt(yearInput.value, 10);
      if (!chosenMonth || !chosenYear) return;
      const student = students[selectedIndex];
      const yearMonth = `${chosenYear}-${String(chosenMonth).padStart(2, '0')}`;
      if (!monthlySchedulesByMonth[yearMonth]) {
        monthlySchedulesByMonth[yearMonth] = {};
      }
      // Save currentSchedule (which already has per-session "time modified")
      monthlySchedulesByMonth[yearMonth][student.id] = currentSchedule;
      saveMonthlySchedules();
    }

    // 10) Render schedule table (using currentSchedule array)
    function renderTable() {
      datesTableBody.innerHTML = '';
      currentSchedule.forEach((item, index) => {
        const row = document.createElement('tr');
        // Date
        const dateCell = document.createElement('td');
        dateCell.textContent = item.date;
        if (item.manual) {
          row.classList.add('manually-added-class');
          const badge = document.createElement('span');
          badge.className = 'added-class-badge';
          badge.textContent = 'Added class';
          dateCell.appendChild(badge);
        }
        row.appendChild(dateCell);
        // Cancellation Status remains as before
        const cancelStatusCell = document.createElement('td');
        if (item.canceled) {
          cancelStatusCell.textContent = item.violation ? 'Canceled (compensated)' : 'Canceled';
        } else {
          cancelStatusCell.textContent = 'Scheduled';
        }
        row.appendChild(cancelStatusCell);
        // Make-up Class
        const makeupCell = document.createElement('td');
        makeupCell.textContent = item.makeup ? `${item.makeup.date} ${item.makeup.time}` : 'N/A';
        row.appendChild(makeupCell);
        // New: Time Modified column
        const timeModCell = document.createElement('td');
        timeModCell.textContent = item["time modified"] !== undefined ? item["time modified"] : 0;
        row.appendChild(timeModCell);
        // Actions: Only include "Mark Cancelled", "Unmark Cancelled", and "Modify Time"
        const actionCell = document.createElement('td');
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Mark Cancelled';
        cancelBtn.addEventListener('click', (evt) => openCancellationPopup(index, evt));
        actionCell.appendChild(cancelBtn);
        const unmarkBtn = document.createElement('button');
        unmarkBtn.textContent = 'Unmark Cancelled';
        unmarkBtn.style.marginLeft = '5px';
        unmarkBtn.addEventListener('click', () => unmarkCancelled(index));
        actionCell.appendChild(unmarkBtn);
        // New: Modify Time button
        const modifyBtn = document.createElement('button');
        modifyBtn.textContent = 'Modify Time';
        modifyBtn.style.marginLeft = '5px';
        modifyBtn.addEventListener('click', (evt) => openTimeModifierPopup(index, evt));
        actionCell.appendChild(modifyBtn);

        if (item.canceled) {
          cancelBtn.disabled = true;
          unmarkBtn.disabled = false;
        } else {
          cancelBtn.disabled = false;
          unmarkBtn.disabled = true;
        }
        row.appendChild(actionCell);
        datesTableBody.appendChild(row);
      });
    }

    function openAddScheduledClassModal() {
      const monthInfo = getManagedMonthInfo();
      if (!monthInfo || studentSelect.value === '') {
        alert('Please select a student and valid month/year first.');
        return;
      }
      selectedDatesForNewClasses = [];
      addClassDateInput.min = monthInfo.firstDate;
      addClassDateInput.max = monthInfo.lastDate;
      addClassDateInput.value = monthInfo.firstDate;
      addClassLengthInput.value = students[studentSelect.value].sessionLength || '';
      addClassMonthHint.textContent = `Choose date(s) within ${monthInfo.monthName}.`;
      addScheduledClassModal.style.display = 'flex';
      renderSelectedNewClassDates();
      validateAddScheduledClassForm();
    }

    function closeAddScheduledClassModal() {
      addScheduledClassModal.style.display = 'none';
      selectedDatesForNewClasses = [];
    }

    function renderSelectedNewClassDates() {
      selectedClassDates.innerHTML = '';
      if (selectedDatesForNewClasses.length === 0) {
        selectedClassDates.textContent = 'No dates selected.';
        return;
      }
      selectedDatesForNewClasses.forEach(dateValue => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.textContent = `${dateValue} x`;
        chip.title = 'Remove this date';
        chip.style.marginRight = '6px';
        chip.style.marginBottom = '6px';
        chip.addEventListener('click', () => {
          selectedDatesForNewClasses = selectedDatesForNewClasses.filter(d => d !== dateValue);
          renderSelectedNewClassDates();
          validateAddScheduledClassForm();
        });
        selectedClassDates.appendChild(chip);
      });
    }

    function validateAddScheduledClassForm() {
      const monthInfo = getManagedMonthInfo();
      const length = parseFloat(addClassLengthInput.value);
      const outsideDate = selectedDatesForNewClasses.find(dateValue => !isDateInManagedMonth(dateValue));
      let message = '';
      if (!monthInfo) {
        message = 'Please enter a valid month and year first.';
      } else if (selectedDatesForNewClasses.length === 0) {
        message = 'Please add at least one date.';
      } else if (outsideDate) {
        message = `Please choose a date within ${monthInfo.monthName}.`;
      } else if (!Number.isFinite(length) || length <= 0) {
        message = 'Please enter a session length greater than 0.';
      }
      addClassValidationMsg.textContent = message;
      confirmAddClassBtn.disabled = !!message;
    }

    addClassDateBtn.addEventListener('click', () => {
      const dateValue = addClassDateInput.value;
      if (!dateValue) {
        validateAddScheduledClassForm();
        return;
      }
      if (!selectedDatesForNewClasses.includes(dateValue)) {
        selectedDatesForNewClasses.push(dateValue);
        selectedDatesForNewClasses.sort();
      }
      renderSelectedNewClassDates();
      validateAddScheduledClassForm();
    });

    addClassDateInput.addEventListener('change', () => {
      validateAddScheduledClassForm();
    });

    addClassLengthInput.addEventListener('input', validateAddScheduledClassForm);

    confirmAddClassBtn.addEventListener('click', () => {
      validateAddScheduledClassForm();
      if (confirmAddClassBtn.disabled) return;
      const student = students[studentSelect.value];
      const requestedLength = parseFloat(addClassLengthInput.value);
      const baseLength = parseFloat(student.sessionLength) || 0;
      const timeModified = Number((requestedLength - baseLength).toFixed(2));
      selectedDatesForNewClasses.forEach(dateValue => {
        currentSchedule.push({
          date: dateInputToScheduleDate(dateValue),
          profile: scheduleProfiles.values(student),
          manual: true,
          canceled: false,
          violation: false,
          makeup: null,
          "time modified": timeModified
        });
      });
      currentSchedule.sort((a, b) => {
        const aDate = scheduleDateToDateInput(a.date);
        const bDate = scheduleDateToDateInput(b.date);
        return aDate > bDate ? 1 : (aDate < bDate ? -1 : 0);
      });
      persistCurrentSchedule();
      renderTable();
      recalcCharge();
      closeAddScheduledClassModal();
    });

    addScheduledClassBtn.addEventListener('click', openAddScheduledClassModal);
    cancelAddClassBtn.addEventListener('click', closeAddScheduledClassModal);

    // 11) "Mark Cancelled" popup logic
    function openCancellationPopup(index, evt) {
      cancellationPopup.style.left = (evt.clientX + 10) + 'px';
      cancellationPopup.style.top = (evt.clientY + 10) + 'px';
      activeIndex = index;
      const data = currentSchedule[index];
      violationCheckbox.checked = data.violation;
      makeupCheckbox.checked = !!data.makeup;
      if (data.makeup) {
        makeupDateInput.value = data.makeup.date;
        makeupTimeInput.value = data.makeup.time;
      } else {
        makeupDateInput.value = '';
        makeupTimeInput.value = '';
      }
      makeupDetails.style.display = makeupCheckbox.checked ? 'block' : 'none';
      cancellationPopup.style.display = 'block';
    }
    saveCancellationBtn.addEventListener('click', () => {
      if (activeIndex === null) return;
      const data = currentSchedule[activeIndex];
      data.canceled = true;
      data.violation = violationCheckbox.checked;
      if (makeupCheckbox.checked) {
        // Use the values directly from the inputs.
        // Note: makeupDateInput.value is in "YYYY-MM-DD" format and makeupTimeInput.value is in "HH:MM" format.
        data.makeup = { 
          date: makeupDateInput.value, 
          time: makeupTimeInput.value 
        };
      } else {
        data.makeup = null;
      }
      persistCurrentSchedule();
      renderTable();
      recalcCharge();
      closePopup();
    });
    closePopupBtn.addEventListener('click', closePopup);
    function closePopup() {
      cancellationPopup.style.display = 'none';
      activeIndex = null;
    }
    makeupCheckbox.addEventListener('change', () => {
      if (makeupCheckbox.checked) {
        makeupDetails.style.display = 'block';
      } else {
        makeupDetails.style.display = 'none';
      }
    });
    
    function unmarkCancelled(index) {
      const data = currentSchedule[index];
      data.canceled = false;
      data.violation = false;
      data.makeup = null;
      persistCurrentSchedule();
      renderTable();
      recalcCharge();
    }

    // 12) New: "Modify Time" popup logic
    let timeModifierIndex = null;
    function openTimeModifierPopup(index, evt) {
      timeModifierPopup.style.left = (evt.clientX + 10) + 'px';
      timeModifierPopup.style.top = (evt.clientY + 10) + 'px';
      timeModifierIndex = index;
      const currentVal = currentSchedule[index]["time modified"];
      timeModifierInput.value = currentVal !== undefined ? currentVal : 0;
      timeModifierPopup.style.display = 'block';
    }
    saveTimeModifierBtn.addEventListener('click', () => {
      if (timeModifierIndex === null) return;
      const newVal = parseFloat(timeModifierInput.value) || 0;
      currentSchedule[timeModifierIndex]["time modified"] = newVal;
      persistCurrentSchedule();
      renderTable();
      recalcCharge();
      timeModifierPopup.style.display = 'none';
      timeModifierIndex = null;
    });
    cancelTimeModifierBtn.addEventListener('click', () => {
      timeModifierPopup.style.display = 'none';
      timeModifierIndex = null;
    });

    // 13) Recompute summary and total charge.
    // Here, for each non-canceled session, effective time = student.sessionLength + (item["time modified"] || 0)
    function recalcCharge() {
      const selectedIndex = studentSelect.value;
      if (selectedIndex === '') {
        scheduledCountDisplay.textContent = '0';
        canceledCountDisplay.textContent = '0';
        makeupCountDisplay.textContent = '0';
        profileModifierDisplay.textContent = '0';
        totalChargeDisplay.textContent = '0';
        return;
      }
      const student = students[selectedIndex];
      const classes = currentSchedule;
      const scheduledCount = classes.length;
      const canceledCount = classes.filter(i => i.canceled).length;
      const violationCount = classes.filter(i => i.violation).length;
      const makeupCount = classes.filter(i => i.makeup !== null).length;
      scheduledCountDisplay.textContent = String(scheduledCount);
      canceledCountDisplay.textContent = String(canceledCount);
      makeupCountDisplay.textContent = String(makeupCount);
      const totals = scheduleProfiles.totals(student, classes, false);
      profileModifierDisplay.textContent = String(totals.modifier);
      totalChargeDisplay.textContent = String(totals.actual);
    }
    updateChargeBtn.addEventListener('click', recalcCharge);

    // 14) Print Buttons (removed print individual and batch print buttons from monthlyView)
    // (We do not include any print buttons here)

    // 15) Backup / Restore / Clear
    downloadJsonBtn.addEventListener('click', () => {
      const dataStr = JSON.stringify(monthlySchedulesByMonth, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'monthly_schedules_by_month.json';
      link.click();
      URL.revokeObjectURL(url);
    });
    uploadJsonBtn.addEventListener('click', () => {
      uploadJsonInput.click();
    });
    uploadJsonInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (typeof imported === 'object' && imported !== null) {
            monthlySchedulesByMonth = imported;
            saveMonthlySchedules();
            loadOrGenerateSchedule();
            alert('Monthly schedules successfully imported from JSON.');
          } else {
            alert('Invalid JSON format. Expected an object keyed by YYYY-MM.');
          }
        } catch (err) {
          alert('Error parsing JSON file.');
        }
      };
      reader.readAsText(file);
    });
    clearLocalStorageBtn.addEventListener('click', () => {
      const confirmClear = window.confirm('Are you sure you want to clear all monthly schedules from local storage? This cannot be undone.');
      if (!confirmClear) return;
      localStorage.removeItem('monthlySchedulesByMonth');
      monthlySchedulesByMonth = {};
      currentSchedule = [];
      renderTable();
      recalcCharge();
      alert('Local storage cleared.');
    });

    // 16) Listen for changes => auto-load schedule
    studentSelect.addEventListener('change', loadOrGenerateSchedule);
    monthInput.addEventListener('change', loadOrGenerateSchedule);
    yearInput.addEventListener('change', loadOrGenerateSchedule);

    // 17) Initial auto-load
    if (studentSelect.value === '' && students.length > 0) {
      studentSelect.value = '0';
    }
    loadOrGenerateSchedule();
  }
};
