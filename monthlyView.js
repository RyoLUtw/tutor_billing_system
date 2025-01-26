// views/monthlyView.js
const monthlyView = {
  // We now expect an object with { students, parents } so we can build a parent->child map
  render: function (rootElement, { students, parents }) {
    //
    // 1) Load existing monthly schedules from localStorage (if any)
    //
    const schedulesData = localStorage.getItem('monthlySchedulesByMonth');
    let monthlySchedulesByMonth = schedulesData ? JSON.parse(schedulesData) : {};
    /*
       The structure is:
       {
         "2025-01": {
           "student_abc": [ { date, canceled, violation, makeup }, ... ],
           "student_xyz": [ ... ]
         },
         "2025-02": {
           ...
         }
       }
    */

    //
    // 2) Build our DOM
    //
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>

      <!-- Summary section above total charge -->
      <h2>Summary</h2>
      <div>
        <p>Scheduled Classes: <span id="scheduledCountDisplay">0</span></p>
        <p>Cancelled Classes: <span id="canceledCountDisplay">0</span></p>
        <p>Make-Up Classes: <span id="makeupCountDisplay">0</span></p>
        <p>Profile Modifier: <span id="profileModifierDisplay">0</span></p>
        <label for="tempModifierInput">Temporary Modifier:</label>
        <input type="number" id="tempModifierInput" value="0" />
      </div>

      <h3>Total Charge: <span id="totalChargeDisplay">0</span></h3>
      <button id="updateChargeBtn">Update Charge</button>
      
      <div>
        <button id="printIndividualBtn">Print This Student’s Charge</button>
        <button id="printAllBtn">Batch Print All Students</button>
      </div>

      <hr />

      <h2>Backup / Restore / Clear</h2>
      <div>
        <button id="downloadJsonBtn">Download All Schedules as JSON</button>
        <input type="file" id="uploadJsonInput" accept=".json" style="display:none" />
        <button id="uploadJsonBtn">Upload JSON</button>
        <button id="clearLocalStorageBtn">Clear Local Storage</button>
      </div>

      <!-- Popup for marking cancellation -->
      <div 
        id="cancellationPopup" 
        style="
          display:none; 
          position:absolute; 
          background-color:#eee; 
          border:1px solid #000; 
          padding:10px;
          z-index:9999;
        ">
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
    `;
    rootElement.appendChild(container);

    // References to DOM elements
    const studentSelect = container.querySelector('#studentSelect');
    const monthInput = container.querySelector('#monthInput');
    const yearInput = container.querySelector('#yearInput');
    const datesTableBody = container.querySelector('#datesTable tbody');
    
    // Summary Elements
    const scheduledCountDisplay = container.querySelector('#scheduledCountDisplay');
    const canceledCountDisplay = container.querySelector('#canceledCountDisplay');
    const makeupCountDisplay = container.querySelector('#makeupCountDisplay');
    const profileModifierDisplay = container.querySelector('#profileModifierDisplay');
    const tempModifierInput = container.querySelector('#tempModifierInput');
    
    // Total Charge
    const totalChargeDisplay = container.querySelector('#totalChargeDisplay');
    const updateChargeBtn = container.querySelector('#updateChargeBtn');

    // Print Buttons
    const printIndividualBtn = container.querySelector('#printIndividualBtn');
    const printAllBtn = container.querySelector('#printAllBtn');

    // Backup/Restore/Clear
    const downloadJsonBtn = container.querySelector('#downloadJsonBtn');
    const uploadJsonBtn = container.querySelector('#uploadJsonBtn');
    const uploadJsonInput = container.querySelector('#uploadJsonInput');
    const clearLocalStorageBtn = container.querySelector('#clearLocalStorageBtn');

    // Cancellation popup
    const cancellationPopup = container.querySelector('#cancellationPopup');
    const violationCheckbox = container.querySelector('#violationCheckbox');
    const makeupCheckbox = container.querySelector('#makeupCheckbox');
    const makeupDetails = container.querySelector('#makeupDetails');
    const makeupDateInput = container.querySelector('#makeupDateInput');
    const makeupTimeInput = container.querySelector('#makeupTimeInput');
    const saveCancellationBtn = container.querySelector('#saveCancellationBtn');
    const closePopupBtn = container.querySelector('#closePopupBtn');

    // The array of classes for the currently selected student, in the chosen month
    let currentSchedule = [];
    let activeIndex = null; // which row is being edited in the popup

    // --------------------------------------------------
    // 1) Populate student dropdown in PARENT order
    // --------------------------------------------------

    // Build a quick map: parentId -> parent object
    // Also, childId -> parentId so we can find each student's parent
    const parentMap = {};
    parents.forEach(p => {
      parentMap[p.id] = p;
    });

    // Build a dictionary: studentId -> parentName (if we have an ID link)
    // 1) In parentProfileView, we store p.children = array of student IDs
    //    So let's invert that to find each student's parentId
    const studentParentName = {};
    parents.forEach(parentObj => {
      (parentObj.children || []).forEach(childId => {
        // childId is the student's .id
        studentParentName[childId] = parentObj.name;
      });
    });

    // Now sort students by parentName from studentParentName
    students.sort((a, b) => {
      const aParent = studentParentName[a.id] || ''; 
      const bParent = studentParentName[b.id] || '';
      // Compare by parent's name
      return aParent.localeCompare(bParent);
    });

    // Now create the <option> elements in sorted order
    students.forEach((s, i) => {
      const option = document.createElement('option');
      option.value = i;
      // We'll show parent's name in parentheses, if it exists
      const parentName = studentParentName[s.id] || 'No Parent';
      option.textContent = `${s.name} (${parentName})`;
      studentSelect.appendChild(option);
    });

    // --------------------------------------------------
    // 2) Default month/year to today's date
    // --------------------------------------------------
    const now = new Date();
    monthInput.value = now.getMonth() + 1;
    yearInput.value = now.getFullYear();

    // --------------------------------------------------
    // Helper: day string -> number
    // --------------------------------------------------
    function getDayNumber(dayString) {
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      return days.findIndex(d => d.toLowerCase() === dayString.toLowerCase());
    }

    // --------------------------------------------------
    // Generate a new schedule for a student's classDays, if none is stored
    // --------------------------------------------------
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
        if (dayNum < 0) return; // skip invalid

        let d = new Date(yearNum, monthNum - 1, 1);
        while (d.getMonth() === (monthNum - 1)) {
          if (d.getDay() === dayNum) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            result.push({
              date: `${y}/${m}/${dd}`,
              canceled: false,
              violation: false,
              makeup: null
            });
          }
          d.setDate(d.getDate() + 1);
        }
      });
      result.sort((a, b) => (a.date > b.date ? 1 : -1));
      return result;
    }

    // --------------------------------------------------
    // Load or generate the schedule for the selected student + yearMonth
    // --------------------------------------------------
    function loadOrGenerateSchedule() {
      const selectedIndex = studentSelect.value;
      if (selectedIndex === '') {
        currentSchedule = [];
        renderTable();
        recalcCharge();
        return;
      }
      const chosenMonth = parseInt(monthInput.value, 10);
      const chosenYear = parseInt(yearInput.value, 10);
      if (!chosenMonth || !chosenYear) {
        currentSchedule = [];
        renderTable();
        recalcCharge();
        return;
      }

      const student = students[selectedIndex];
      const yearMonth = `${chosenYear}-${String(chosenMonth).padStart(2, '0')}`;

      // Create object for that month-year if doesn't exist
      if (!monthlySchedulesByMonth[yearMonth]) {
        monthlySchedulesByMonth[yearMonth] = {};
      }
      // If we already have a schedule for this student, load it
      if (monthlySchedulesByMonth[yearMonth][student.id]) {
        currentSchedule = monthlySchedulesByMonth[yearMonth][student.id];
      } else {
        // Otherwise generate a new schedule
        currentSchedule = generateSchedule(student, yearMonth);
        // Store it
        monthlySchedulesByMonth[yearMonth][student.id] = currentSchedule;
        saveMonthlySchedules();
      }

      renderTable();
      recalcCharge();
    }

    // --------------------------------------------------
    // Save entire monthlySchedulesByMonth to localStorage
    // --------------------------------------------------
    function saveMonthlySchedules() {
      localStorage.setItem('monthlySchedulesByMonth', JSON.stringify(monthlySchedulesByMonth));
    }

    // --------------------------------------------------
    // Render the table for currentSchedule
    // --------------------------------------------------
    function renderTable() {
      datesTableBody.innerHTML = '';
      currentSchedule.forEach((item, index) => {
        const row = document.createElement('tr');
        
        // Date
        const dateCell = document.createElement('td');
        dateCell.textContent = item.date;
        row.appendChild(dateCell);

        // Cancellation Status
        const cancelStatusCell = document.createElement('td');
        if (item.canceled) {
          // If also a violation, display "Canceled (compensated)"
          if (item.violation) {
            cancelStatusCell.textContent = 'Canceled (compensated)';
          } else {
            cancelStatusCell.textContent = 'Canceled';
          }
        } else {
          cancelStatusCell.textContent = 'Scheduled';
        }
        row.appendChild(cancelStatusCell);

        // Make-up Class
        const makeupCell = document.createElement('td');
        if (item.makeup) {
          makeupCell.textContent = `${item.makeup.date} ${item.makeup.time}`;
        } else {
          makeupCell.textContent = 'N/A';
        }
        row.appendChild(makeupCell);

        // Actions
        const actionCell = document.createElement('td');

        // Mark Cancelled button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Mark Cancelled';
        // Pass the click event to position the popup near the cursor
        cancelBtn.addEventListener('click', (evt) => openCancellationPopup(index, evt));
        actionCell.appendChild(cancelBtn);

        // Unmark Cancelled button
        const unmarkBtn = document.createElement('button');
        unmarkBtn.textContent = 'Unmark Cancelled';
        unmarkBtn.style.marginLeft = '5px';
        unmarkBtn.addEventListener('click', () => unmarkCancelled(index));
        actionCell.appendChild(unmarkBtn);

        // Show/hide buttons depending on canceled state
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

    // --------------------------------------------------
    // "Mark Cancelled" popup
    // --------------------------------------------------
    function openCancellationPopup(index, evt) {
      // Position the popup near the cursor
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

    makeupCheckbox.addEventListener('change', () => {
      makeupDetails.style.display = makeupCheckbox.checked ? 'block' : 'none';
    });

    saveCancellationBtn.addEventListener('click', () => {
      if (activeIndex === null) return;
      const data = currentSchedule[activeIndex];
      data.canceled = true;
      data.violation = violationCheckbox.checked;
      if (makeupCheckbox.checked) {
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

    // 2) FIX “Close” button to hide popup
    closePopupBtn.addEventListener('click', closePopup);

    function closePopup() {
      cancellationPopup.style.display = 'none';
      activeIndex = null;
    }

    // --------------------------------------------------
    // Unmark Cancelled
    // --------------------------------------------------
    function unmarkCancelled(index) {
      const data = currentSchedule[index];
      data.canceled = false;
      data.violation = false;
      data.makeup = null;
      persistCurrentSchedule();
      renderTable();
      recalcCharge();
    }

    // --------------------------------------------------
    // Recompute the summary + total charge
    // --------------------------------------------------
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
      const scheduledCount = currentSchedule.length;
      const canceledCount = currentSchedule.filter(i => i.canceled).length;
      const violationCount = currentSchedule.filter(i => i.violation).length;
      // Count how many items have a non-null "makeup"
      const makeupCount = currentSchedule.filter(i => i.makeup !== null).length;
      
      // Show these counts in the summary
      scheduledCountDisplay.textContent = String(scheduledCount);
      canceledCountDisplay.textContent = String(canceledCount);
      makeupCountDisplay.textContent = String(makeupCount);
      profileModifierDisplay.textContent = String(student.additionalChargeModifier);

      // Parse the temp modifier
      const tempModifier = parseFloat(tempModifierInput.value) || 0;

      // totalCharge
      const totalCharge =
        (student.hourlyRate * student.sessionLength * (scheduledCount - canceledCount + makeupCount)) +
        (500 * violationCount) +
        student.additionalChargeModifier +
        tempModifier;
      
      totalChargeDisplay.textContent = String(totalCharge);
    }

    updateChargeBtn.addEventListener('click', recalcCharge);

    // --------------------------------------------------
    // Print Buttons
    // --------------------------------------------------
    printIndividualBtn.addEventListener('click', () => {
      window.print();
    });

    printAllBtn.addEventListener('click', () => {
      alert('Batch printing not implemented. (Placeholder)');
    });

    // --------------------------------------------------
    // Backup / Restore / Clear
    // --------------------------------------------------
    downloadJsonBtn.addEventListener('click', () => {
      // 1) Read the current month/year from inputs
      const chosenMonth = parseInt(monthInput.value, 10);
      const chosenYear = parseInt(yearInput.value, 10);
      const mm = String(chosenMonth).padStart(2, '0');
      const yearMonth = `${chosenYear}_${mm}`;
    
      // 2) Build the file name
      const fileName = `${yearMonth}_schedule_backup.json`;
    
      // 3) Create the JSON blob
      const dataStr = JSON.stringify(monthlySchedulesByMonth, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
    
      // 4) Download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
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
      const confirmClear = window.confirm('Are you sure you want to clear all monthly schedules from local storage?');
      if (!confirmClear) return;

      localStorage.removeItem('monthlySchedulesByMonth');
      monthlySchedulesByMonth = {};
      currentSchedule = [];
      renderTable();
      recalcCharge();
      alert('Local storage cleared.');
    });

    // --------------------------------------------------
    // Helper: persist the current schedule
    // --------------------------------------------------
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
      monthlySchedulesByMonth[yearMonth][student.id] = currentSchedule;
      saveMonthlySchedules();
    }

    // --------------------------------------------------
    // 3) Listen for changes => auto-load the schedule
    // --------------------------------------------------
    studentSelect.addEventListener('change', loadOrGenerateSchedule);
    monthInput.addEventListener('change', loadOrGenerateSchedule);
    yearInput.addEventListener('change', loadOrGenerateSchedule);

    // --------------------------------------------------
    // 4) Initial auto-load
    // --------------------------------------------------
    if (studentSelect.value === '' && students.length > 0) {
      studentSelect.value = '0';
    }
    loadOrGenerateSchedule();
  }
};
