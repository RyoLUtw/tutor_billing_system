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
    +  confirmArchiveBtn.addEventListener('click', () => {
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
      const s = students[selectedIndex];
      s.name = nameInput.value;
      s.classDays = getSelectedDays();
      s.sessionLength = parseFloat(sessionLengthInput.value) || 0;
      s.hourlyRate = parseFloat(hourlyRateInput.value) || 0;
      s.additionalChargeModifier = parseFloat(chargeModifierInput.value) || 0;
      refreshStudentTable();
      onDataUpdate(students);
      clearForm();
    });

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
