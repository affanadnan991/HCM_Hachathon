import db from '../config/db.js';

export const dateUtils = {
  // Check if a date string (YYYY-MM-DD) falls on a weekend
  isWeekend(dateStr, weekendDays = ['Saturday', 'Sunday']) {
    const d = new Date(dateStr + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    return weekendDays.includes(dayName);
  },

  // Calculate working days between start_date and end_date (inclusive)
  // Automatically skips weekends (Sat-Sun) and registered public holidays
  calculateWorkingDays(startDateStr, endDateStr, weekendDays = ['Saturday', 'Sunday']) {
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');

    if (end < start) {
      throw new Error('End date cannot be earlier than start date.');
    }

    // Fetch registered public holidays
    const holidays = new Set(
      db.prepare(`SELECT holiday_date FROM public_holidays`).all().map(h => h.holiday_date)
    );

    let workingDaysCount = 0;
    const current = new Date(start);

    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;

      const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });

      const isWknd = weekendDays.includes(dayName);
      const isHol = holidays.has(localDateStr);

      if (!isWknd && !isHol) {
        workingDaysCount += 1;
      }

      current.setDate(current.getDate() + 1);
    }

    return workingDaysCount;
  },

  // Calculate Haversine distance in meters between two coordinates
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;

    const R = 6371000; // Earth's radius in meters
    const toRad = deg => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  },

  // Calculate work hours between check-in and check-out
  calculateHoursDifference(startTimeIso, endTimeIso) {
    const start = new Date(startTimeIso);
    const end = new Date(endTimeIso);
    const diffMs = end - start;
    if (diffMs < 0) return 0;
    return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
  }
};
