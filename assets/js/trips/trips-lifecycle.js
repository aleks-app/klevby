(function () {
  "use strict";

  const ARCHIVE_RETENTION_DAYS = 30;
  const DAY_MS = 24 * 60 * 60 * 1000;

  function startOfDay(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function getTripDate(trip) {
    return trip?.tripDate || trip?.date || trip?.startsAt || trip?.startDate || null;
  }

  function getLifecycleShelf(trip, options = {}) {
    const today = startOfDay(options.today || new Date());
    const tripDay = startOfDay(getTripDate(trip));

    // Undated trips are treated as active for now: this is the safest shell behavior
    // because no visible archive item should appear without a reliable past date.
    if (!tripDay || !today) return "active";

    if (tripDay.getTime() >= today.getTime()) return "active";

    const ageDays = Math.floor((today.getTime() - tripDay.getTime()) / DAY_MS);
    if (ageDays <= ARCHIVE_RETENTION_DAYS) return "archive";
    return "expired";
  }

  function partitionTrips(trips = [], options = {}) {
    return trips.reduce((result, trip) => {
      const shelf = getLifecycleShelf(trip, options);
      if (shelf === "active") result.active.push(trip);
      if (shelf === "archive") result.archive.push(trip);
      return result;
    }, { active: [], archive: [] });
  }

  window.KlevbyTripsLifecycle = {
    ARCHIVE_RETENTION_DAYS,
    getLifecycleShelf,
    partitionTrips
  };
}());
