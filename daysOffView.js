// daysOffView.js
const daysOffView = {
    render: function(rootElement, { students, monthlySchedulesByMonth }) {
      // Create the UI elements
      const container = document.createElement('div');
      container.innerHTML = `
        <h1>Mark Days Off</h1>
        <div style="margin-bottom:10px;">
          <h3>Start Date</h3>
          <label>Year:</label>
          <select id="startYear"></select>
          <label>Month:</label>
          <select id="startMonth"></select>
          <label>Day:</label>
          <select id="startDay"></select>
        </div>
        <div style="margin-bottom:10px;">
          <h3>End Date</h3>
          <label>Year:</label>
          <select id="endYear"></select>
          <label>Month:</label>
          <select id="endMonth"></select>
          <label>Day:</label>
          <select id="endDay"></select>
        </div>
        <div>
          <button id="retrieveBtn">Retrieve Class Schedule</button>
        </div>
        <div id="tableContainer" style="margin-top:20px;"></div>
        <div style="margin-top:20px;">
          <button id="confirmBtn">Confirm Cancellation</button>
        </div>
      `;
      rootElement.appendChild(container);
  
      // References to dropdowns and buttons
      const startYearSelect = container.querySelector('#startYear');
      const startMonthSelect = container.querySelector('#startMonth');
      const startDaySelect = container.querySelector('#startDay');
      const endYearSelect = container.querySelector('#endYear');
      const endMonthSelect = container.querySelector('#endMonth');
      const endDaySelect = container.querySelector('#endDay');
      const retrieveBtn = container.querySelector('#retrieveBtn');
      const tableContainer = container.querySelector('#tableContainer');
      const confirmBtn = container.querySelector('#confirmBtn');
  
      // Helper: current year and next year
      const now = new Date();
      const currentYear = now.getFullYear();
      const nextYear = currentYear + 1;
  
      // Populate year dropdowns (current and next year)
      [startYearSelect, endYearSelect].forEach(select => {
        select.innerHTML = '';
        [currentYear, nextYear].forEach(y => {
          const opt = document.createElement('option');
          opt.value = y;
          opt.textContent = y;
          select.appendChild(opt);
        });
      });
      startYearSelect.value = currentYear;
      endYearSelect.value = currentYear;
  
      // Populate month dropdowns (1-12)
      [startMonthSelect, endMonthSelect].forEach(select => {
        select.innerHTML = '';
        for (let m = 1; m <= 12; m++) {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          select.appendChild(opt);
        }
      });
      startMonthSelect.value = now.getMonth() + 1;
      endMonthSelect.value = now.getMonth() + 1;
  
      // Helper: populate day dropdown based on year and month
      function populateDayDropdown(yearSelect, monthSelect, daySelect) {
        const y = parseInt(yearSelect.value, 10);
        const m = parseInt(monthSelect.value, 10);
        const daysInMonth = new Date(y, m, 0).getDate();
        daySelect.innerHTML = '';
        for (let d = 1; d <= daysInMonth; d++) {
          const opt = document.createElement('option');
          opt.value = d;
          opt.textContent = d;
          daySelect.appendChild(opt);
        }
      }
      // Populate both day dropdowns initially
      populateDayDropdown(startYearSelect, startMonthSelect, startDaySelect);
      populateDayDropdown(endYearSelect, endMonthSelect, endDaySelect);
  
      // 2. Update end date if start date changes:
      function updateEndDateIfNeeded() {
        // Build Date objects from start and end dropdowns.
        const startY = parseInt(startYearSelect.value, 10);
        const startM = parseInt(startMonthSelect.value, 10);
        const startD = parseInt(startDaySelect.value, 10);
        const endY = parseInt(endYearSelect.value, 10);
        const endM = parseInt(endMonthSelect.value, 10);
        const endD = parseInt(endDaySelect.value, 10);
        const startDate = new Date(startY, startM - 1, startD);
        const endDate = new Date(endY, endM - 1, endD);
        // If end date is before start date, update end date to match start date.
        if (endDate < startDate) {
          endYearSelect.value = startYearSelect.value;
          endMonthSelect.value = startMonthSelect.value;
          // Repopulate end day dropdown based on new end year/month.
          populateDayDropdown(endYearSelect, endMonthSelect, endDaySelect);
          endDaySelect.value = startDaySelect.value;
        }
      }
      // Attach change event listeners to start date dropdowns
      [startYearSelect, startMonthSelect, startDaySelect].forEach(select => {
        select.addEventListener('change', updateEndDateIfNeeded);
      });
  
      // When year or month changes for end date, update the days
      [endYearSelect, endMonthSelect].forEach(select => {
        select.addEventListener('change', () => populateDayDropdown(endYearSelect, endMonthSelect, endDaySelect));
      });
  
      // Maintain a set of dates already added
      let retrievedDates = new Set();
  
      // Helper: given a date string "YYYY/MM/DD", return the "YYYY/MM/DD" itself and also "YYYY-MM" key.
      function getYearMonth(dateStr) {
        const parts = dateStr.split('/');
        if(parts.length !== 3) return { date: null, ym: null };
        return { date: dateStr, ym: `${parts[0]}-${parts[1].padStart(2,'0')}` };
      }
  
      // Helper: Ensure schedules exist for all students for all year–months in datesArray.
      function ensureSchedulesExist(datesArray) {
        const uniqueYM = new Set();
        datesArray.forEach(dateStr => {
          const { ym } = getYearMonth(dateStr);
          if(ym) uniqueYM.add(ym);
        });
        uniqueYM.forEach(ym => {
          if (!monthlySchedulesByMonth[ym]) {
            monthlySchedulesByMonth[ym] = {};
          }
          const missingStudents = students.filter(student => !monthlySchedulesByMonth[ym][student.id]);
          if(missingStudents.length > 0) {
            const names = missingStudents.map(s => s.name).join(', ');
            const answer = confirm(`The schedule for ${ym} doesn't exist for: ${names}. Do you want to create them?`);
            if(answer) {
              missingStudents.forEach(student => {
                monthlySchedulesByMonth[ym][student.id] = generateSchedule(student, ym);
              });
              localStorage.setItem('monthlySchedulesByMonth', JSON.stringify(monthlySchedulesByMonth));
            }
          }
        });
      }
  
      // Helper: Build table.
      // The table is transposed: first column is student names, subsequent columns are dates.
      function buildTable(datesArray) {
        let table = tableContainer.querySelector('table');
        if (!table) {
          table = document.createElement('table');
          table.border = '1';
          table.style.width = '100%';
          tableContainer.appendChild(table);
          // Build header row: first cell is "學生姓名"
          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');
          const firstTh = document.createElement('th');
          firstTh.textContent = "學生姓名";
          headerRow.appendChild(firstTh);
          thead.appendChild(headerRow);
          table.appendChild(thead);
          // Build tbody: one row per student
          const tbody = document.createElement('tbody');
          students.forEach(student => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            nameCell.textContent = student.name;
            row.appendChild(nameCell);
            tbody.appendChild(row);
          });
          table.appendChild(tbody);
        }
        // Get header row and tbody
        const headerRow = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');
        // Get existing dates from header (skip first cell)
        const existingDates = Array.from(headerRow.cells).slice(1).map(th => th.textContent.split(' ')[0]); // split to remove delete button text
        datesArray.forEach(dateStr => {
          if (existingDates.includes(dateStr)) return;
          retrievedDates.add(dateStr);
          // Create header cell with delete button
          const th = document.createElement('th');
          const span = document.createElement('span');
          span.textContent = dateStr;
          th.appendChild(span);
          const delBtn = document.createElement('button');
          delBtn.textContent = 'X';
          delBtn.style.marginLeft = '5px';
          delBtn.addEventListener('click', () => {
            // Remove this column from header and each row
            const colIndex = Array.from(headerRow.cells).indexOf(th);
            headerRow.deleteCell(colIndex);
            Array.from(tbody.rows).forEach(row => {
              row.deleteCell(colIndex);
            });
            retrievedDates.delete(dateStr);
          });
          th.appendChild(delBtn);
          headerRow.appendChild(th);
    
          // Append new cell for each student row
          Array.from(tbody.rows).forEach(row => {
            const cell = document.createElement('td');
            // Get student name from first cell.
            const studentName = row.cells[0].textContent;
            const student = students.find(s => s.name === studentName);
            // Determine year-month from dateStr.
            const { ym } = getYearMonth(dateStr);
            let hasClass = false;
            if (monthlySchedulesByMonth[ym] && monthlySchedulesByMonth[ym][student.id]) {
              const schedule = monthlySchedulesByMonth[ym][student.id];
              hasClass = schedule.some(item => item.date === dateStr);
            }
            if (hasClass) {
              const checkbox = document.createElement('input');
              checkbox.type = 'checkbox';
              checkbox.checked = true;
              checkbox.dataset.studentId = student.id;
              checkbox.dataset.date = dateStr;
              cell.appendChild(checkbox);
            }
            row.appendChild(cell);
          });
        });
      }
  
      // "Retrieve Class Schedule" button event
      retrieveBtn.addEventListener('click', () => {
        // Parse start and end dates from dropdowns
        const startY = parseInt(startYearSelect.value, 10);
        const startM = parseInt(startMonthSelect.value, 10);
        const startD = parseInt(startDaySelect.value, 10);
        const endY = parseInt(endYearSelect.value, 10);
        const endM = parseInt(endMonthSelect.value, 10);
        const endD = parseInt(endDaySelect.value, 10);
        const startDate = new Date(startY, startM - 1, startD);
        const endDate = new Date(endY, endM - 1, endD);
        if (startDate > endDate) {
          alert("Start date must not be after end date.");
          return;
        }
        // Build array of date strings in "YYYY/MM/DD"
        let newDates = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const yearStr = d.getFullYear();
          const monthStr = String(d.getMonth() + 1).padStart(2, '0');
          const dayStr = String(d.getDate()).padStart(2, '0');
          newDates.push(`${yearStr}/${monthStr}/${dayStr}`);
        }
        // Ensure schedules exist for all students for all relevant year–months.
        ensureSchedulesExist(newDates);
        // Append new dates to the table (avoid duplicates)
        buildTable(newDates);
      });
  
      // "Confirm Cancellation" button event: mark all checked classes as cancelled (without violation)
      confirmBtn.addEventListener('click', () => {
        const checkboxes = tableContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(chk => {
          if(chk.checked) {
            const dateStr = chk.dataset.date;
            const studentId = chk.dataset.studentId;
            const parts = dateStr.split('/');
            if(parts.length !== 3) return;
            const ym = `${parts[0]}-${parts[1].padStart(2,'0')}`;
            if(monthlySchedulesByMonth[ym] && monthlySchedulesByMonth[ym][studentId]) {
              const schedule = monthlySchedulesByMonth[ym][studentId];
              schedule.forEach(item => {
                if(item.date === dateStr) {
                  item.canceled = true;
                  item.violation = false;
                }
              });
            }
          }
        });
        localStorage.setItem('monthlySchedulesByMonth', JSON.stringify(monthlySchedulesByMonth));
        alert("Selected classes have been marked as cancelled.");
      });
  
      // Helper: generate schedule using existing function.
      function getDayNumber(dayString) {
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        return days.findIndex(d => d.toLowerCase() === dayString.toLowerCase());
      }
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
  
      // Save updated monthlySchedulesByMonth to localStorage
      function saveMonthlySchedules() {
        localStorage.setItem('monthlySchedulesByMonth', JSON.stringify(monthlySchedulesByMonth));
      }
  
    }
  };
  