// Per-session profile snapshots preserve historical terms across profile edits.
const scheduleProfiles = {
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  date(value) {
    return String(value).replace(/\//g, '-').split('-').map((v, i) => i ? v.padStart(2, '0') : v).join('-');
  },
  values(student, item) {
    const source = { ...student, ...item?.profile };
    return Object.fromEntries(['name', 'classDays', 'sessionLength', 'hourlyRate', 'additionalChargeModifier']
      .map(key => [key, Array.isArray(source[key]) ? [...source[key]] : source[key]]));
  },
  latest(student, items) {
    const latest = [...items].sort((a, b) => this.date(b.date).localeCompare(this.date(a.date)))[0];
    return this.values(student, latest);
  },
  totals(student, items, includeMakeup = true) {
    const modifier = Number(this.latest(student, items).additionalChargeModifier || 0);
    let expected = modifier, actual = modifier;
    items.forEach(item => {
      const p = this.values(student, item);
      expected += Number(p.hourlyRate) * Number(p.sessionLength);
      if (!item.canceled || (includeMakeup && item.makeup)) {
        actual += Number(p.hourlyRate) * (Number(p.sessionLength) + Number(item['time modified'] || 0));
      }
      if (item.violation) actual += 500;
    });
    return { expected, actual, modifier };
  },
  apply(months, student, intervals) {
    const result = JSON.parse(JSON.stringify(months));
    const contains = (range, date) => (!range.start || date >= range.start) && (!range.end || date <= range.end);
    Object.entries(result).forEach(([month, map]) => {
      if (!Array.isArray(map[student.id])) return;
      let items = map[student.id].map(item => ({ ...item, profile: this.values(student, item) }));
      intervals.forEach(range => {
        // Only rebuild recurring weekdays when they actually changed. Preserve exceptions.
        const sameDays = p => [...(p.classDays || [])].sort().join() === [...range.profile.classDays].sort().join();
        const previous = items.map(item => ({ ...item, profile: this.values(student, item) }));
        items = items.filter(item => {
          const date = this.date(item.date);
          if (!contains(range, date)) return true;
          const weekday = this.days[new Date(`${date}T12:00:00`).getDay()];
          const keep = sameDays(item.profile) || range.profile.classDays.includes(weekday)
            || item.canceled || item.makeup || item['time modified'] || item.manual;
          item.profile = this.values(range.profile);
          return keep;
        });
        const [year, monthNumber] = month.split('-').map(Number);
        const count = new Date(year, monthNumber, 0).getDate();
        for (let day = 1; day <= count; day++) {
          const date = `${month}-${String(day).padStart(2, '0')}`;
          if (!contains(range, date)) continue;
          const prior = this.latest(student, previous.filter(item => this.date(item.date) <= date));
          if (sameDays(prior) || !range.profile.classDays.includes(this.days[new Date(year, monthNumber - 1, day).getDay()])) continue;
          if (!items.some(item => this.date(item.date) === date)) {
            items.push({ date: date.replace(/-/g, '/'), canceled: false, violation: false,
              makeup: null, 'time modified': 0, profile: this.values(range.profile) });
          }
        }
      });
      map[student.id] = items.sort((a, b) => this.date(a.date).localeCompare(this.date(b.date)));
    });
    return result;
  }
};
