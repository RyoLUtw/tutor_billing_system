// views/profileView.js
const studentProfileView = {
  render: function (rootElement, { students, onDataUpdate }) {
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

    rootElement.appendChild(container);

    // Grab references to the elements
    const nameInput = container.querySelector('#nameInput');

    // Checkboxes
    const daySun = container.querySelector('#daySun');
    const dayMon = container.querySelector('#dayMon');
    const dayTue = container.querySelector('#dayTue');
    const dayWed = container.querySelector('#dayWed');
    const dayThu = container.querySelector('#dayThu');
    const dayFri = container.querySelector('#dayFri');
    const daySat = container.querySelector('#daySat');
    const allDayCheckboxes = [daySun, dayMon, dayTue, dayWed, dayThu, dayFri, daySat];

    const sessionLengthInput = container.querySelector('#sessionLengthInput');
    const hourlyRateInput = container.querySelector('#hourlyRateInput');
    const chargeModifierInput = container.querySelector('#chargeModifierInput');
    
    const saveStudentBtn = container.querySelector('#saveStudentBtn');
    const updateStudentBtn = container.querySelector('#updateStudentBtn');
    const studentsTableBody = container.querySelector('#studentsTable tbody');

    const downloadJsonBtn = container.querySelector('#downloadJsonBtn');
    const uploadJsonBtn = container.querySelector('#uploadJsonBtn');
    const uploadJsonInput = container.querySelector('#uploadJsonInput');

    // ------------------------------
    // Utility functions
    // ------------------------------

    function getSelectedDays() {
      // Collect whichever checkboxes are checked
      return allDayCheckboxes
        .filter(cb => cb.checked)
        .map(cb => cb.value); // e.g. ["Sunday", "Wednesday"]
    }

    function setSelectedDays(daysArray) {
      // Uncheck all first
      allDayCheckboxes.forEach(cb => (cb.checked = false));
      // Check the boxes that match the array
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

        // Name
        const nameCell = document.createElement('td');
        nameCell.textContent = student.name;
        row.appendChild(nameCell);

        // Class Days
        const daysCell = document.createElement('td');
        daysCell.textContent = (student.classDays || []).join(', ');
        row.appendChild(daysCell);

        // Session Length
        const lengthCell = document.createElement('td');
        lengthCell.textContent = student.sessionLength;
        row.appendChild(lengthCell);

        // Hourly Rate
        const rateCell = document.createElement('td');
        rateCell.textContent = student.hourlyRate;
        row.appendChild(rateCell);

        // Modifier
        const modifierCell = document.createElement('td');
        modifierCell.textContent = student.additionalChargeModifier;
        row.appendChild(modifierCell);

        // Action (Edit / Delete)
        const actionCell = document.createElement('td');
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editStudent(index));
        actionCell.appendChild(editBtn);

        // Spacer
        const spacer = document.createTextNode(' ');
        actionCell.appendChild(spacer);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteStudent(index));
        actionCell.appendChild(deleteBtn);

        row.appendChild(actionCell);

        studentsTableBody.appendChild(row);
      });
    }

    function editStudent(index) {
      selectedIndex = index;
      const student = students[index];

      // Populate form fields
      nameInput.value = student.name;
      setSelectedDays(student.classDays || []);
      sessionLengthInput.value = student.sessionLength;
      hourlyRateInput.value = student.hourlyRate;
      chargeModifierInput.value = student.additionalChargeModifier;
    }

    function deleteStudent(index) {
      const student = students[index];
      const confirmDelete = window.confirm(
        `Are you sure you want to delete ${student.name}'s profile?`
      );
      if (!confirmDelete) return;
      
      // Remove from array
      students.splice(index, 1);
      // Refresh table
      refreshStudentTable();
      // Persist changes
      onDataUpdate(students);
      // If we were editing that student, reset form
      if (selectedIndex === index) {
        clearForm();
      }
    }

    function clearForm() {
      selectedIndex = null;
      nameInput.value = '';
      allDayCheckboxes.forEach(cb => (cb.checked = false));
      sessionLengthInput.value = '';
      hourlyRateInput.value = '';
      chargeModifierInput.value = '';
    }

    // ------------------------------
    // Event Listeners
    // ------------------------------

    saveStudentBtn.addEventListener('click', () => {
      // Create a new student
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
      // If no student is selected, do nothing
      if (selectedIndex === null) {
        alert('No student selected for update. Please click "Edit" on a student first.');
        return;
      }

      // Update existing student
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
      const dataStr = JSON.stringify(students, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'students_backup.json';
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
          if (Array.isArray(imported)) {
            // Replace the global array
            students.splice(0, students.length, ...imported);
            refreshStudentTable();
            onDataUpdate(students);
          } else {
            alert('Invalid JSON format. Expected an array of students.');
          }
        } catch (err) {
          alert('Error parsing JSON file.');
        }
      };
      reader.readAsText(file);
    });

    // ------------------------------
    // Initial load
    // ------------------------------
    refreshStudentTable();
  }
};
