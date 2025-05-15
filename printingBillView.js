// views/printingBillView.js
const printingBillView = {
  render: function (rootElement, { parents, students, archivedStudents = [], monthlySchedulesByMonth }) {
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Printing Bill</h1>
      <div>
        <label>Select Parent:</label>
        <select id="parentSelect"></select>
      </div>
      <div>
        <label>Month (1-12):</label>
        <input type="number" id="monthInput" min="1" max="12" />
        <label>Year:</label>
        <input type="number" id="yearInput" />
      </div>
      <div>
        <button id="generateBillBtn">Generate Bill</button>
        <button id="printBtn">Print to PNG</button>
      </div>
      <div id="billContainer"></div>
    `;
    rootElement.appendChild(container);

    const parentSelect = container.querySelector('#parentSelect');
    const monthInput = container.querySelector('#monthInput');
    const yearInput = container.querySelector('#yearInput');
    const generateBillBtn = container.querySelector('#generateBillBtn');
    const printBtn = container.querySelector('#printBtn');
    const billContainer = container.querySelector('#billContainer');

    // Populate parent dropdown based on actual schedules in selected month
    function populateParentSelect() {
      parentSelect.innerHTML = '';
      const chosenMonth = parseInt(monthInput.value, 10);
      const chosenYear  = parseInt(yearInput.value, 10);
      const ym = `${chosenYear}-${String(chosenMonth).padStart(2,'0')}`;
      const monthMap = monthlySchedulesByMonth[ym] || {};

      parents.forEach(parent => {
        // include parent if any of their children has ≥1 session this month
        //console.log("parent: ", parent.children)
        const hasSchedule = parent.children.some(childId => {
          const sched = monthMap[childId];
          return Array.isArray(sched) && sched.length > 0;
        });
        //onsole.log("has schedule?",hasSchedule)
        if (hasSchedule) {
          const opt = document.createElement('option');
          opt.value = parent.id;
          opt.textContent = parent.name;
          parentSelect.appendChild(opt);
        }
      });
    }
    
    // Default month/year to current date
    const now = new Date();
    monthInput.value = now.getMonth() + 1;
    yearInput.value = now.getFullYear();
    
    
    // initial population and re-populate on month/year change
    populateParentSelect();
    monthInput.addEventListener('change', populateParentSelect);
    yearInput.addEventListener('change',  populateParentSelect);


    

    function generateBill() {
      billContainer.innerHTML = '';
      const parentId = parentSelect.value;
      if (!parentId) {
        alert('Please select a parent.');
        return;
      }
      const chosenMonth = parseInt(monthInput.value, 10);
      const chosenYear = parseInt(yearInput.value, 10);
      if (!chosenMonth || !chosenYear) {
        alert('Please enter valid month and year.');
        return;
      }
       const parentObj = parents.find(p => p.id === parentId);
      if (!parentObj) {
        alert('Selected parent not found.');
        return;
      }
      const yearMonth = `${chosenYear}-${String(chosenMonth).padStart(2, '0')}`;
      const allStudents = students.concat(archivedStudents);

      console.log('>>> Print Bill DEBUG <<<');
      console.log('parents array:', parents);
      console.log('students array:', students);
      console.log('monthlySchedulesByMonth object:', monthlySchedulesByMonth);
      console.log('Selected parent:', parentObj);
      console.log('Chosen yearMonth:', yearMonth);

      let totalAllChildren = 0;
      let foundAnyData = false;
      parentObj.children.forEach(childId => {
        console.log('Now checking childId:', childId);
        const student = allStudents.find(s => s.id === childId);
        if (!student) {
          console.log(`No matching student found for childId=${childId}. Skipping.`);
          return;
        }
        console.log('Found student:', student);
        const schedulesForYearMonth = monthlySchedulesByMonth[yearMonth];
        if (!schedulesForYearMonth) {
          console.log(`No entry found in monthlySchedulesByMonth for key=${yearMonth}.`);
          return;
        }
        const scheduleObj = schedulesForYearMonth[student.id];
        if (!scheduleObj) {
          console.log(`No schedule found for studentId=${student.id} under yearMonth=${yearMonth}.`);
          return;
        }
        foundAnyData = true;
        console.log('Found schedule object:', scheduleObj);
        // For old JSON, scheduleObj is an array; use it directly.
        const schedule = Array.isArray(scheduleObj) ? scheduleObj : scheduleObj.classes;

        const childDiv = document.createElement('div');
        childDiv.style.border = '1px solid #000';
        childDiv.style.marginBottom = '20px';
        childDiv.innerHTML = `<h2>學生姓名: ${student.name}</h2>`;

        // Build table header WITHOUT extra column; status column will include time modifier info.
        const table = document.createElement('table');
        table.border = '1';
        table.style.width = '100%';
        const thead = document.createElement('thead');
        thead.innerHTML = `
          <tr>
            <th>日期</th>
            <th>狀態</th>
            <th>補課</th>
          </tr>
        `;
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        let canceledCount = 0;
        let makeupCount = 0;
        let sumEffectiveTime = 0; // Sum effective session time for non-canceled sessions (or makeup sessions)
        schedule.forEach(item => {
          const row = document.createElement('tr');
          // Date column
          const dateTd = document.createElement('td');
          dateTd.textContent = item.date;
          row.appendChild(dateTd);
          // Status column
          const statusTd = document.createElement('td');
          if (item.canceled) {
            if (item.makeup && item.violation) {
              statusTd.textContent = '請假(酌收補償金500元, 補課)';
            } else if (item.makeup) {
              statusTd.textContent = '請假 (補課)';
            } else if (item.violation) {
              statusTd.textContent = '請假(酌收補償金500元)';
            } else {
              statusTd.textContent = '請假';
            }
            canceledCount++;
            // If makeup is arranged, even if canceled, we add its effective session time.
            if (item.makeup) {
              sumEffectiveTime += student.sessionLength + (item["time modified"] || 0);
            }
          } else {
            const mod = item["time modified"] || 0;
            if (mod > 0) {
              statusTd.textContent = `延長${mod}小時`;
            } else if (mod < 0) {
              statusTd.textContent = `減少${Math.abs(mod)}小時`;
            } else {
              statusTd.textContent = '正常上課';
            }
            sumEffectiveTime += student.sessionLength + (item["time modified"] || 0);
          }

          row.appendChild(statusTd);
          // Makeup column
          const makeupTd = document.createElement('td');
          if (item.makeup) {
            makeupTd.textContent = `${item.makeup.date} ${item.makeup.time}`;
            makeupCount++;
          } else {
            makeupTd.textContent = '無補課';
          }
          row.appendChild(makeupTd);
          tbody.appendChild(row);
        });
        table.appendChild(tbody);
        childDiv.appendChild(table);

        // Compute totals for this student:
        const totalScheduled = schedule.length;
        const totalViolation = schedule.filter(i => i.violation).length;
        // Expected charge uses base session time (without modifiers)
        const expected = (student.hourlyRate * student.sessionLength * totalScheduled)
          + student.additionalChargeModifier;
        // Actual charge uses the summed effective session time from non-canceled or makeup sessions
        const actual = (student.hourlyRate * sumEffectiveTime)
          + (500 * totalViolation)
          + student.additionalChargeModifier;
        totalAllChildren += actual;

        // Build summary table for this student.
        // Add a new row for 總上課時數 above 費用小計.
        const summaryTable = document.createElement('table');
        summaryTable.border = '1';
        summaryTable.style.width = '100%';
        summaryTable.innerHTML = `
          <thead>
            <tr><th></th><th>數量/金額</th></tr>
          </thead>
          <tbody>
            <tr><td>排定上課次數</td><td>${totalScheduled}</td></tr>
            <tr><td>請假次數</td><td>${canceledCount}</td></tr>
            <tr><td>補課次數</td><td>${makeupCount}</td></tr>
            <tr><td>總上課時數</td><td>${sumEffectiveTime.toFixed(2)}</td></tr>
            <tr><td>費用小計</td><td>${actual.toFixed(2)}</td></tr>
          </tbody>
        `;
        childDiv.appendChild(summaryTable);
        billContainer.appendChild(childDiv);
      });
      if (!foundAnyData) {
        alert(`No data found for parent "${parentObj.name}" in ${yearMonth}.`);
        return;
      }

      // Add parent's billModifierValue to the total, if any.
      totalAllChildren += parentObj.billModifierValue || 0;

      const h1 = document.createElement('h1');
      h1.textContent = `總費用: ${totalAllChildren.toFixed(2)}`;
      billContainer.appendChild(h1);
    }

    // Trigger generateBill on change of parent, month, or year
    generateBillBtn.addEventListener('click', generateBill);
    parentSelect.addEventListener('change', generateBill);
    monthInput.addEventListener('change', generateBill);
    yearInput.addEventListener('change', generateBill);
    if (parentSelect.value === '' && parents.length > 0) {
      parentSelect.value = '0';
    }

    // Print to PNG with margin and custom filename
    printBtn.addEventListener('click', () => {
      const originalPadding = billContainer.style.padding;
      billContainer.style.padding = '20px';
      html2canvas(billContainer).then(canvas => {
        billContainer.style.padding = originalPadding || '';
        const chosenMonth = parseInt(monthInput.value, 10);
        const chosenYear = parseInt(yearInput.value, 10);
        const mm = String(chosenMonth).padStart(2, '0');
        const parentObj = parents[parentSelect.value];
        const safeParentName = parentObj.name.replace(/\s+/g, '');
        const fileName = `${chosenYear}_${mm}_${safeParentName}_bill.png`;
        const link = document.createElement('a');
        link.download = fileName;
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    });
  }
};
