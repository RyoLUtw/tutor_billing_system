// views/profileView.js
const studentProfileView = {
  render: function (rootElement, {
    students,
    archivedStudents = [],
    monthlySchedulesByMonth = {},
    onDataUpdate,
    onArchivedDataUpdate
  }) {
    // We'll keep track of which student we're editing (if any).
    let selectedIndex = null;

    // Create a container
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Student Profile</h1>
      
      <!-- Input fields for creating/updating a student -->
      <div>
        <label>Name:</label>
        <input type="text" id="nameInput" />
      </div>

      <!-- Checkboxes for each day of the week -->
      <div>
        <label>Class Days:</label>
        <br/>
        <input type="checkbox" id="daySun" value="Sunday" />Sunday
        <input type="checkbox" id="dayMon" value="Monday" />Monday
        <input type="checkbox" id="dayTue" value="Tuesday" />Tuesday
        <input type="checkbox" id="dayWed" value="Wednesday" />Wednesday
        <input type="checkbox" id="dayThu" value="Thursday" />Thursday
        <input type="checkbox" id="dayFri" value="Friday" />Friday
        <input type="checkbox" id="daySat" value="Saturday" />Saturday
      </div>

      <div>
        <label>Session Length (hours, one decimal place):</label>
        <input type="number" step="0.1" id="sessionLengthInput" />
      </div>
      <div>
        <label>Hourly Rate:</label>
        <input type="number" id="hourlyRateInput" />
      </div>
      <div>
        <label>Additional Charge Modifier (+/-):</label>
        <input type="number" id="chargeModifierInput" />
      </div>
      
      <button id="saveStudentBtn">Save New Student</button>
      <button id="updateStudentBtn">Update Selected Student</button>
      
      <h2>Current Students</h2>
      <!-- Table to list all students -->
      <table id="studentsTable" border="1">
        <thead>
          <tr>
            <th>Name</th>
            <th>Class Days</th>
            <th>Session Length</th>
            <th>Hourly Rate</th>
            <th>Modifier</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>

      <hr/>

      <div>
        <button id="downloadJsonBtn">Download Profiles as JSON</button>
        <input type="file" id="uploadJsonInput" accept=".json" style="display:none" />
        <button id="uploadJsonBtn">Upload JSON</button>
      </div>
    `;

    // management for restore-archived modal
    const viewArchiveBtn = document.createElement('button');
    viewArchiveBtn.textContent = 'View Archived Students';
    container.appendChild(viewArchiveBtn);

    const archiveModal = document.createElement('div');
    archiveModal.id = 'archiveModal';
    Object.assign(archiveModal.style, {
      display: 'none',
      position: 'fixed',
      top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center'
    });
    archiveModal.innerHTML = `
      <div style="background:#fff; padding:20px; border-radius:8px; width:90%; max-width:500px;">
        <h2>Archived Students</h2>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Class Days</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <div style="margin-top:16px; text-align:right;">
          <button id="restoreBtn">Restore Selected</button>
          <button id="closeArchiveBtn">Close</button>
        </div>
      </div>
    `;
    container.appendChild(archiveModal);

    function openRestoreModal() {
      populateRestoreTable();
      archiveModal.style.display = 'flex';
    }
    function closeRestoreModal() {
      archiveModal.style.display = 'none';
    }
    function populateRestoreTable() {
      const tbody = archiveModal.querySelector('tbody');
      tbody.innerHTML = '';
      archivedStudents.forEach((student, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="text-align:center;">
            <input type="checkbox" data-index="${idx}" />
          </td>
          <td>${student.name}</td>
          <td>${(student.classDays||[]).join(', ')}</td>
        `;
        tbody.appendChild(tr);
      });
    }
    viewArchiveBtn.addEventListener('click', openRestoreModal);
    archiveModal.querySelector('#closeArchiveBtn').addEventListener('click', closeRestoreModal);
    archiveModal.querySelector('#restoreBtn').addEventListener('click', () => {
      const checked = [...archiveModal.querySelectorAll('input[type=checkbox]:checked')]
        .map(cb => parseInt(cb.dataset.index))
        .sort((a,b) => b - a);
      checked.forEach(i => {
        const stud = archivedStudents[i];
        students.push(stud);
        archivedStudents.splice(i, 1);
      });
      onDataUpdate(students);
      onArchivedDataUpdate && onArchivedDataUpdate(archivedStudents);
      refreshStudentTable();
      closeRestoreModal();
    });

    // management for schedule-check archival modal
    container.insertAdjacentHTML('beforeend', `
      <div id="scheduleCheckModal" style="display:none; position:fixed; top:20%; left:50%; transform:translateX(-50%); background:#fff; border:1px solid #444; padding:1em; z-index:1000;">
        <h3>Archive Student</h3>
        <label>
          Archived since:
          <input type="month" id="archiveSinceInput" />
        </label>
        <button id="retrieveScheduleBtn">Retrieve Schedule</button>
        <div id="scheduleCheckContainer" style="margin:1em 0;"></div>
        <button id="confirmArchiveBtn" disabled>Confirm Archive</button>
        <button id="cancelArchiveBtn">Cancel</button>
      </div>
    `);
    const scheduleCheckModal    = container.querySelector('#scheduleCheckModal');
    const archiveSinceInput     = scheduleCheckModal.querySelector('#archiveSinceInput');
    const retrieveScheduleBtn   = scheduleCheckModal.querySelector('#retrieveScheduleBtn');
    const scheduleCheckContainer= scheduleCheckModal.querySelector('#scheduleCheckContainer');
    const confirmArchiveBtn     = scheduleCheckModal.querySelector('#confirmArchiveBtn');
    const cancelArchiveBtn      = scheduleCheckModal.querySelector('#cancelArchiveBtn');

    // default "since" to today
    (()=>{
      const now = new Date();
      archiveSinceInput.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    })();

    let currentStudent = null;
    function openArchiveModal(student) {
      currentStudent = student;
      scheduleCheckContainer.innerHTML = '';
      confirmArchiveBtn.disabled = true;
      scheduleCheckModal.style.display = 'block';
    }
    cancelArchiveBtn.addEventListener('click', () => {
      scheduleCheckModal.style.display = 'none';
    });
    retrieveScheduleBtn.addEventListener('click', () => {
      const ym = archiveSinceInput.value;
      const monthMap = monthlySchedulesByMonth[ym] || {};
      const sched = monthMap[currentStudent.id] || [];
      scheduleCheckContainer.innerHTML = '';
      if (!sched.length) {
        scheduleCheckContainer.textContent =
          `No class scheduled for ${ym}. Student ready to be archived.`;
        confirmArchiveBtn.disabled = false;
        return;
      }
      const tbl = document.createElement('table');
      tbl.border = 1;
      tbl.innerHTML = `
        <thead>
          <tr>
            <th>Date</th>
            <th>Cancellation Status</th>
            <th>Make-up Class</th>
            <th>調整時數</th>
            <th>Keep?</th>
          </tr>
        </thead>
      `;
      const tb = document.createElement('tbody');
      sched.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${item.date}</td>
          <td>${item.canceled
               ? (item.violation ? 'Canceled (vio)' : 'Canceled')
               : 'Scheduled'}</td>
          <td>${item.makeup
               ? `${item.makeup.date} ${item.makeup.time}`
               : 'N/A'}</td>
          <td>${item["time modified"]||0}</td>
          <td><input type="checkbox" data-keep-index="${idx}" checked /></td>
        `;
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      scheduleCheckContainer.appendChild(tbl);
      confirmArchiveBtn.disabled = false;
    });
    confirmArchiveBtn.addEventListener('click', () => {
    const ym       = archiveSinceInput.value;                    // “YYYY-MM”
    const monthMap = monthlySchedulesByMonth[ym] || {};          // grab that month
    const sched    = monthMap[currentStudent.id] || [];

    // 1) figure out which rows the user still wants to keep
    const keepIdxs = Array.from(
      scheduleCheckContainer.querySelectorAll('input[data-keep-index]')
    )
    .filter(cb => cb.checked)
    .map(cb => parseInt(cb.dataset.keepIndex, 10));

    // 2) build the filtered schedule
    const newSched = sched.filter((_, i) => keepIdxs.includes(i));

    // 3) write it back (delete entire key if user kept none)
    if (newSched.length) monthMap[currentStudent.id] = newSched;
    else                 delete monthMap[currentStudent.id];
    monthlySchedulesByMonth[ym] = monthMap;
    localStorage.setItem(
      'monthlySchedulesByMonth',
      JSON.stringify(monthlySchedulesByMonth)
    );

    // 4) now archive the student as before
    currentStudent.archivedSince = ym;
    archivedStudents.push(currentStudent);
   onArchivedDataUpdate(archivedStudents);
    onDataUpdate(students.filter(s => s.id !== currentStudent.id));

    scheduleCheckModal.style.display = 'none';
  });

    rootElement.appendChild(container);

    // Grab references to the elements
    const nameInput = container.querySelector('#nameInput');
    const daySun = container.querySelector('#daySun');
    const dayMon = container.querySelector('#dayMon');
    const dayTue = container.querySelector('#dayTue');
    const dayWed = container.querySelector('#dayWed');
    const dayThu = container.querySelector('#dayThu');
    const dayFri = container.querySelector('#dayFri');
    const daySat = container.querySelector('#daySat');
    const allDayCheckboxes = [daySun, dayMon, dayTue, dayWed, dayThu, dayFri, daySat];
    const sessionLengthInput = container.querySelector('#sessionLengthInput');
    const hourlyRateInput     = container.querySelector('#hourlyRateInput');
    const chargeModifierInput = container.querySelector('#chargeModifierInput');
    const saveStudentBtn      = container.querySelector('#saveStudentBtn');
    const updateStudentBtn    = container.querySelector('#updateStudentBtn');
    const studentsTableBody   = container.querySelector('#studentsTable tbody');
    const downloadJsonBtn     = container.querySelector('#downloadJsonBtn');
    const uploadJsonBtn       = container.querySelector('#uploadJsonBtn');
    const uploadJsonInput     = container.querySelector('#uploadJsonInput');

    // Utility functions
    function getSelectedDays() {
      return allDayCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
    }
    function setSelectedDays(daysArray) {
      allDayCheckboxes.forEach(cb => (cb.checked = false));
      daysArray.forEach(day => {
        const match = allDayCheckboxes.find(cb => cb.value === day);
        if (match) match.checked = true;
      });
    }

    // Renders the table of all current students
    function refreshStudentTable() {
      studentsTableBody.innerHTML = '';
      students.forEach((student, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${student.name}</td>
          <td>${(student.classDays||[]).join(', ')}</td>
          <td>${student.sessionLength}</td>
          <td>${student.hourlyRate}</td>
          <td>${student.additionalChargeModifier}</td>
          <td>
            <button class="editBtn">Edit</button>
            <button class="archiveBtn">Archive</button>
          </td>
        `;
        row.querySelector('.editBtn').addEventListener('click', () => editStudent(index));
        row.querySelector('.archiveBtn').addEventListener('click', () => openArchiveModal(student));
        studentsTableBody.appendChild(row);
      });
    }

    function editStudent(index) {
      selectedIndex = index;
      const student = students[index];
      nameInput.value = student.name;
      setSelectedDays(student.classDays || []);
      sessionLengthInput.value = student.sessionLength;
      hourlyRateInput.value = student.hourlyRate;
      chargeModifierInput.value = student.additionalChargeModifier;
    }

    function clearForm() {
      selectedIndex = null;
      nameInput.value = '';
      allDayCheckboxes.forEach(cb => (cb.checked = false));
      sessionLengthInput.value = '';
      hourlyRateInput.value = '';
      chargeModifierInput.value = '';
    }

    // Event Listeners
    saveStudentBtn.addEventListener('click', () => {
      const student = {
        id: `student_${Date.now()}`,
        name: nameInput.value,
        classDays: getSelectedDays(),
        sessionLength: parseFloat(sessionLengthInput.value) || 0,
        hourlyRate: parseFloat(hourlyRateInput.value) || 0,
        additionalChargeModifier: parseFloat(chargeModifierInput.value) || 0
      };
      students.push(student);
      refreshStudentTable();
      onDataUpdate(students);
      clearForm();
    });

    updateStudentBtn.addEventListener('click', () => {
      if (selectedIndex === null) {
        alert('No student selected for update. Please click "Edit" on a student first.');
        return;
      }
      openScheduleUpdateModal();
    });

    function openScheduleUpdateModal() {
      const student = students[selectedIndex];
      const proposed = {
        name: nameInput.value,
        classDays: getSelectedDays(),
        sessionLength: Number(sessionLengthInput.value),
        hourlyRate: Number(hourlyRateInput.value),
        additionalChargeModifier: Number(chargeModifierInput.value)
      };
      const recorded = Object.values(monthlySchedulesByMonth).flatMap(map => map[student.id] || []);
      const latest = scheduleProfiles.latest(student, recorded);
      // Explicit edits take precedence over the latest recorded defaults.
      const defaults = { ...latest };
      Object.keys(proposed).forEach(key => {
        if (JSON.stringify(proposed[key]) !== JSON.stringify(student[key])) defaults[key] = proposed[key];
      });
      const dialog = document.createElement('dialog');
      dialog.id = 'scheduleUpdateDialog';
      dialog.setAttribute('aria-labelledby', 'scheduleUpdateTitle');
      dialog.style.cssText = 'width:min(90vw,760px);max-height:85vh;overflow:auto;border:1px solid #b9c6d6;border-radius:10px;padding:24px';
      dialog.innerHTML = `
        <form method="dialog">
          <h2 id="scheduleUpdateTitle">Update student and existing schedules</h2>
          <div id="newScheduleDefaults"></div>
          <label>Existing schedules
            <select id="scheduleUpdateMode">
              <option value="keep">Keep existing schedules unchanged</option>
              <option value="all">Change all existing schedules</option>
              <option value="custom">Custom intervals</option>
            </select>
          </label>
          <p>“Change all” uses the values entered in the student profile form. Custom intervals have independent values.</p>
          <p>Date ranges are inclusive. Weekday changes reschedule regular classes in the interval, including cancelled and previously cancelled classes. Manually added classes keep their dates and status, even when cancelled with a make-up arrangement. Regular classes move to the new weekdays with their time adjustments, cancellation status and compensation status preserved. Make-up dates and times stay unchanged. Interval profile values still apply to all covered classes.</p>
          <p>Each interval starts with the latest scheduled values plus your profile edits. The monthly charge modifier is applied once, using that month’s latest scheduled date.</p>
          <div id="scheduleIntervals"></div>
          <button type="button" id="addScheduleInterval" hidden>+ Add interval</button>
          <p id="scheduleUpdateError" role="alert" style="color:#b42318"></p>
          <button type="submit">Confirm update</button>
          <button type="button" id="cancelScheduleUpdate">Cancel</button>
        </form>`;
      container.appendChild(dialog);
      const mode = dialog.querySelector('#scheduleUpdateMode');
      const list = dialog.querySelector('#scheduleIntervals');
      const add = dialog.querySelector('#addScheduleInterval');
      let sequence = 0;
      function addInterval(target = list, future = false) {
        const id = ++sequence;
        const fieldset = document.createElement('fieldset');
        fieldset.style.cssText = 'margin:16px 0;padding:16px;display:grid;gap:12px';
        fieldset.innerHTML = `
          <legend>${future ? 'Newly created schedules' : `Interval ${id}`}</legend>
          <label>Start <select data-bound="start"><option value="date">Specific date</option><option value="open">All schedules before end date</option></select>
            <input type="date" data-date="start" aria-label="Start date" required></label>
          <label>End <select data-bound="end"><option value="date">Specific date</option><option value="open">All schedules after start date</option></select>
            <input type="date" data-date="end" aria-label="End date" required></label>
          <label>Name <input data-field="name" required></label>
          <div>Class days <div data-days></div></div>
          <label>Session length (hours) <input data-field="sessionLength" type="number" min="0.1" step="0.1" required></label>
          <label>Hourly rate <input data-field="hourlyRate" type="number" min="0" step="any" required></label>
          <label>Additional charge modifier (+/−) <input data-field="additionalChargeModifier" type="number" step="any" required></label>
          <button type="button" data-remove>Remove interval</button>`;
        Object.keys(defaults).filter(key => key !== 'classDays').forEach(key => {
          fieldset.querySelector(`[data-field="${key}"]`).value = defaults[key] ?? '';
        });
        scheduleProfiles.days.forEach(day => {
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox'; checkbox.value = day;
          checkbox.checked = (defaults.classDays || []).includes(day);
          label.append(checkbox, day + ' ');
          fieldset.querySelector('[data-days]').appendChild(label);
        });
        fieldset.querySelectorAll('[data-bound]').forEach(select => {
          select.addEventListener('change', () => {
            const input = fieldset.querySelector(`[data-date="${select.dataset.bound}"]`);
            input.hidden = select.value === 'open';
            input.disabled = input.hidden;
          });
        });
        fieldset.querySelector('[data-remove]').onclick = () => fieldset.remove();
        if (future) {
          fieldset.querySelectorAll('[data-bound], [data-date]').forEach(input => {
            input.disabled = true;
            input.closest('label').hidden = true;
          });
          fieldset.querySelector('[data-remove]').hidden = true;
          const hint = document.createElement('p');
          hint.textContent = 'These become the student profile defaults for all newly created schedules. Existing schedules use the choice below.';
          fieldset.insertBefore(hint, fieldset.children[1]);
        }
        target.appendChild(fieldset);
      }
      mode.onchange = () => {
        list.replaceChildren();
        add.hidden = mode.value !== 'custom';
        if (mode.value === 'custom') addInterval();
      };
      add.onclick = () => addInterval();
      addInterval(dialog.querySelector('#newScheduleDefaults'), true);
      sequence = 0;
      function readProfile(fieldset) {
        const profile = {};
        fieldset.querySelectorAll('[data-field]').forEach(input => {
          profile[input.dataset.field] = input.type === 'number' ? Number(input.value) : input.value;
        });
        profile.classDays = [...fieldset.querySelectorAll('[data-days] input:checked')].map(input => input.value);
        return profile;
      }
      const close = () => { dialog.close(); dialog.remove(); updateStudentBtn.focus(); };
      dialog.querySelector('#cancelScheduleUpdate').onclick = close;
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      dialog.querySelector('form').onsubmit = event => {
        event.preventDefault();
        const error = dialog.querySelector('#scheduleUpdateError');
        error.textContent = '';
        const futureProfile = readProfile(dialog.querySelector('#newScheduleDefaults fieldset'));
        let intervals = [];
        if (mode.value === 'all') intervals = [{ start: '', end: '', profile: proposed }];
        if (mode.value === 'custom') {
          intervals = [...list.children].map(fieldset => {
            const bound = side => fieldset.querySelector(`[data-bound="${side}"]`).value === 'open'
              ? '' : fieldset.querySelector(`[data-date="${side}"]`).value;
            const profile = readProfile(fieldset);
            return { start: bound('start'), end: bound('end'), profile };
          });
          if (!intervals.length) { error.textContent = 'Add at least one interval.'; return; }
          if (intervals.some(r => (!r.start && !r.end) || (r.start && r.end && r.start > r.end))) {
            error.textContent = 'Choose at least one reference date per interval, with start on or before end.'; return;
          }
          intervals.sort((a, b) => a.start.localeCompare(b.start));
          if (intervals.some((r, i) => i && (!intervals[i - 1].end || !r.start || r.start <= intervals[i - 1].end))) {
            error.textContent = 'Intervals must not overlap, including their boundary dates.'; return;
          }
        }
        if ([futureProfile, ...intervals.map(range => range.profile)].some(profile =>
          !profile.name.trim() || !Number.isFinite(profile.sessionLength) || profile.sessionLength <= 0
          || !Number.isFinite(profile.hourlyRate) || profile.hourlyRate < 0 || !Number.isFinite(profile.additionalChargeModifier))) {
          error.textContent = 'Enter a name, positive session length, non-negative rate and valid modifier in the profile.'; return;
        }
        let updatedMonths;
        try {
          updatedMonths = scheduleProfiles.apply(monthlySchedulesByMonth, student, intervals);
        } catch (err) {
          error.textContent = err.message;
          return;
        }
        try {
          localStorage.setItem('monthlySchedulesByMonth', JSON.stringify(updatedMonths));
        } catch (err) { error.textContent = 'Could not save schedules. Please try again.'; return; }
        monthlySchedulesByMonth = updatedMonths;
        Object.assign(student, futureProfile);
        refreshStudentTable();
        onDataUpdate(students);
        clearForm();
        close();
      };
      dialog.showModal();
    }

    downloadJsonBtn.addEventListener('click', () => {
      const backup = { active: students, archived: archivedStudents };
      const dataStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'students_backup.json';
      link.click();
      URL.revokeObjectURL(url);
    });

    uploadJsonBtn.addEventListener('click', () => uploadJsonInput.click());

    uploadJsonInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported && Array.isArray(imported.active) && Array.isArray(imported.archived)) {
            students.splice(0, students.length, ...imported.active);
            archivedStudents.splice(0, archivedStudents.length, ...imported.archived);
            refreshStudentTable();
            onDataUpdate(students);
            onArchivedDataUpdate && onArchivedDataUpdate(archivedStudents);
          } else if (Array.isArray(imported)) {
            students.splice(0, students.length, ...imported);
            refreshStudentTable();
            onDataUpdate(students);
          } else {
            alert('Invalid JSON format. Expected an array of students or {active,archived}.');
          }
        } catch (err) {
          alert('Error parsing JSON file.');
        }
      };
      reader.readAsText(file);
    });

    // Initial load
    refreshStudentTable();
  }
};
