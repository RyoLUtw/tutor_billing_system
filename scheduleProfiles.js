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
        // Reconcile the entire interval, including exceptions left by earlier updates.
        const sameDays = p => [...(p.classDays || [])].sort().join() === [...range.profile.classDays].sort().join();
        const previous = items.map(item => ({ ...item, profile: this.values(student, item) }));
        const covered = previous.filter(item => contains(range, this.date(item.date)));
        const weekdayFor = item => this.days[new Date(`${this.date(item.date)}T12:00:00`).getDay()];
        const isException = item => item.manual;
        const rebuild = covered.length
          ? covered.some(item => !sameDays(item.profile) || (!isException(item) && !range.profile.classDays.includes(weekdayFor(item))))
          : !sameDays(student);
        const movedMakeups = [];
        items = items.filter(item => {
          const date = this.date(item.date);
          if (!contains(range, date)) return true;
          const weekday = this.days[new Date(`${date}T12:00:00`).getDay()];
          const keep = isException(item) || !rebuild || range.profile.classDays.includes(weekday);
          item.profile = this.values(range.profile);
          if (!keep && item.makeup) movedMakeups.push(item);
          return keep;
        });
        const [year, monthNumber] = month.split('-').map(Number);
        const count = new Date(year, monthNumber, 0).getDate();
        const replacements = [];
        for (let day = 1; day <= count; day++) {
          const date = `${month}-${String(day).padStart(2, '0')}`;
          if (!contains(range, date)) continue;
          if (!rebuild || !range.profile.classDays.includes(this.days[new Date(year, monthNumber - 1, day).getDay()])) continue;
          if (!items.some(item => this.date(item.date) === date)) {
            const replacement = { date: date.replace(/-/g, '/'), canceled: false, violation: false,
              makeup: null, 'time modified': 0, profile: this.values(range.profile) };
            items.push(replacement);
            replacements.push(replacement);
          }
        }
        // Move the original cancellation record, not its separately arranged make-up date.
        // Prefer a replacement in the same Monday¡VSunday week, then the nearest available date.
        const timestamp = item => new Date(`${this.date(item.date)}T12:00:00`).getTime();
        const week = item => {
          const date = new Date(timestamp(item));
          date.setDate(date.getDate() - (date.getDay() + 6) % 7);
          return date.getTime();
        };
        movedMakeups.sort((a, b) => timestamp(a) - timestamp(b)).forEach(original => {
          replacements.sort((a, b) =>
            Number(week(b) === week(original)) - Number(week(a) === week(original))
            || Math.abs(timestamp(a) - timestamp(original)) - Math.abs(timestamp(b) - timestamp(original)));
          const replacement = replacements.shift();
          if (!replacement) {
            throw new Error(`No replacement date is available for the class on ${original.date}. Widen the interval or add a class day to keep its make-up arrangement.`);
          }
          const date = replacement.date;
          Object.assign(replacement, original, { date });
        });
      });
      map[student.id] = items.sort((a, b) => this.date(a.date).localeCompare(this.date(b.date)));
    });
    return result;
  }
};
