/**
 * Utility functions for DFC week calculations
 * DFC weeks run Friday 12am ET through Thursday 11:59pm ET
 * Events occur Thursday night
 */

/**
 * Get the start date of the current DFC week (most recent Friday at 12am ET)
 * @returns {Date} The start of the current DFC week in ET timezone
 */
function getCurrentWeekStartDate() {
    // Get current time in ET timezone
    const etTimeString = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const now = new Date(etTimeString);
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday

    // Calculate how many days ago the most recent Friday was
    let daysSinceFriday;
    if (currentDay >= 5) {
        // Currently Friday (5) or Saturday (6)
        daysSinceFriday = currentDay - 5;
    } else {
        // Currently Sunday (0) through Thursday (4)
        // Need to go back to previous week's Friday
        daysSinceFriday = currentDay + 2;
    }

    // Create date for the most recent Friday at midnight
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysSinceFriday);
    weekStart.setHours(0, 0, 0, 0);

    return weekStart;
}

/**
 * Get the end date of the current DFC week (upcoming Thursday at 11:59pm ET)
 * @returns {Date} The end of the current DFC week in ET timezone
 */
function getCurrentWeekEndDate() {
    const weekStart = getCurrentWeekStartDate();

    // Add 6 days to get to Thursday, then set to 11:59:59pm
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return weekEnd;
}

/**
 * Check if a given date falls within the current DFC week
 * @param {Date|string} date - Date to check (Date object or date string)
 * @returns {boolean} True if date is within current DFC week
 */
function isDateInCurrentWeek(date) {
    const checkDate = new Date(date);
    const weekStart = getCurrentWeekStartDate();
    const weekEnd = getCurrentWeekEndDate();

    return checkDate >= weekStart && checkDate <= weekEnd;
}

/**
 * Filter signups to only include those from the current DFC week
 * @param {Array<Array<string>>} signups - Array of signup rows from Google Sheets
 * @param {boolean} skipHeader - Whether to skip the first row (header). Default: true
 * @returns {Array<Array<string>>} Filtered signups from current week only
 */
function filterCurrentWeekSignups(signups, skipHeader = true) {
    const weekStart = getCurrentWeekStartDate();

    // Determine starting index based on skipHeader
    const startIndex = skipHeader ? 1 : 0;

    return signups.slice(startIndex).filter(row => {
        // Skip rows without timestamp (column A)
        if (!row[0]) return false;

        const signupDate = new Date(row[0]);

        // Include signup if it's on or after the current week's Friday 12am ET
        return signupDate >= weekStart;
    });
}

/**
 * Get formatted week range string for display
 * @returns {string} Formatted week range (e.g., "Dec 13 - Dec 19")
 */
function getWeekRangeString() {
    const weekStart = getCurrentWeekStartDate();
    const weekEnd = getCurrentWeekEndDate();

    const startStr = weekStart.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'America/New_York'
    });

    const endStr = weekEnd.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'America/New_York'
    });

    return `${startStr} - ${endStr}`;
}

/**
 * Check if registration is currently open based on the weekly schedule
 * Registration opens: Friday 12am ET
 * Registration closes: Tuesday 11pm ET (23:00)
 * @returns {boolean} True if registration is open, false otherwise
 */
function isRegistrationOpen() {
    // Get current time in ET timezone
    const etTime = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const now = new Date(etTime);
    const day = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const hour = now.getHours();

    // Registration is open from Friday 00:00 through Tuesday 22:59:59
    // Friday = 5, Saturday = 6, Sunday = 0, Monday = 1, Tuesday = 2
    // Closed: Wednesday = 3, Thursday = 4

    if (day === 3 || day === 4) {
        // Wednesday or Thursday - closed
        return false;
    }

    if (day === 2 && hour >= 23) {
        // Tuesday at or after 11pm - closed
        return false;
    }

    // Friday (all day), Saturday, Sunday, Monday, Tuesday (before 11pm) - open
    return true;
}

module.exports = {
    getCurrentWeekStartDate,
    getCurrentWeekEndDate,
    isDateInCurrentWeek,
    filterCurrentWeekSignups,
    getWeekRangeString,
    isRegistrationOpen
};
