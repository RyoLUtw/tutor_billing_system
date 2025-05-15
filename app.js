// app.js

// 1) Global data (in memory) loaded from localStorage
// Adjust keys as needed if you’ve changed the localStorage keys.
let students = JSON.parse(localStorage.getItem('studentsData')) || [];
// load archived students so we never lose their profiles
let archivedStudents = JSON.parse(localStorage.getItem('archivedStudentsData')) || [];
let parents = JSON.parse(localStorage.getItem('parentsData')) || [];
let monthlySchedulesByMonth = JSON.parse(localStorage.getItem('monthlySchedulesByMonth')) || [];
let salaryReviews = [];  // or whatever structure you use for teacher’s review

// Example: a function to update student data from any view
function updateStudents(newStudents) {
  students = newStudents;
  localStorage.setItem('studentsData', JSON.stringify(students));
}

// new helper to persist the archive
function updateArchivedStudents(newArchived) {
  archivedStudents = newArchived;
  localStorage.setItem('archivedStudentsData', JSON.stringify(archivedStudents));
}

// Example: a function to update parent data from the parent view
function updateParents(newParents) {
  parents = newParents;
  localStorage.setItem('parentsData', JSON.stringify(parents));
}

// 2) Reference to the main container
const main = document.getElementById('app');

// 3) Define the router function
function router() {
  // always re-fetch
  monthlySchedulesByMonth = JSON.parse(localStorage.getItem('monthlySchedulesByMonth')) || {};
  const hash = window.location.hash || '#/profile';
  main.innerHTML = ''; // clear current content

  if (hash === '#/profile') {
    // Student Profile
    studentProfileView.render(main, {
      students,
      archivedStudents,
      monthlySchedulesByMonth,
      onDataUpdate: updateStudents,
      onArchivedDataUpdate: updateArchivedStudents
    });
  }
  else if (hash === '#/monthly') {
    // Monthly Charge Summary
    // (assuming your monthlyView expects { students, monthlySchedulesByMonth, ... })
    monthlyView.render(main, {
      students,
      monthlySchedulesByMonth,
      parents
      // add other props if needed
    });
  }
  else if (hash === '#/teacher') {
    // Teacher Salary Review
    // teacherView might need students, monthlySchedules, salaryReviews, etc.
    teacherView.render(main, {
      students,
      archivedStudents,
      monthlySchedules: monthlySchedulesByMonth,
      salaryReviews
    });
  }
  else if (hash === '#/parent') {
    // Parent Profile
    parentProfileView.render(main, {
      parents,
      students,
      archivedStudents,  
      onParentDataUpdate: updateParents
    });
  }
  else if (hash === '#/printbill') {
    // Print Bill
    // printingBillView might need parents, students, monthlySchedulesByMonth
    printingBillView.render(main, {
      parents,
      students,
      archivedStudents,  
      monthlySchedulesByMonth
    });
  }
  else if (hash === "#/daysoff") {
    daysOffView.render(main, {
      students,
      monthlySchedulesByMonth: monthlySchedulesByMonth
    });
  }
  
  else {
    // Fallback: If unknown hash, redirect to #/profile
    window.location.hash = '#/profile';
  }
}

// 4) Listen for hash changes
window.addEventListener('hashchange', router);

// 5) On page load, run the router
window.addEventListener('load', router);
