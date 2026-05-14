/**
 * Utility functions for building staff schedules.
 * Extracted from shop-settings-page.component.ts to reduce component complexity.
 */

export interface Employee {
    id: string;
    name: string;
    phone: string;
    role: string;
    active: boolean;
    username?: string;
    password?: string;
}

export interface DayStaffMember {
    id: string;
    name: string;
    role: string;
    startTime: string;
    endTime: string;
}

export interface DayStaffBucket {
    key: string;
    label: string;
    dateLabel: string;
    isToday: boolean;
    isFocused: boolean;
    staff: DayStaffMember[];
}

export interface MonthCalendarDay {
    isoDate: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    assignedCount: number;
    isToday: boolean;
    staff: DayStaffMember[];
}

export function buildDayStaffBuckets(
    selectedDateValue: string,
    employees: Employee[],
    toIsoDate: (date: Date) => string,
    parseIsoDate: (value: string) => Date | null,
    isSameDate: (left: Date, right: Date) => boolean
): DayStaffBucket[] {
    const today = new Date();
    const focusedDate = parseIsoDate(selectedDateValue) ?? today;
    const focusedDateKey = toIsoDate(focusedDate);
    const baseDate = new Date(focusedDate);
    baseDate.setDate(focusedDate.getDate() - 6);
    const weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const buckets: DayStaffBucket[] = [];

    for (let index = 0; index < 14; index += 1) {
        const currentDate = new Date(baseDate);
        currentDate.setDate(baseDate.getDate() + index);
        const staff = buildStaffMembers(currentDate, employees);

        const dateKey = toIsoDate(currentDate);

        buckets.push({
            key: dateKey,
            label: weekdayLabels[currentDate.getDay()],
            dateLabel: `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
            isToday: isSameDate(currentDate, today),
            isFocused: dateKey === focusedDateKey,
            staff
        });
    }

    return buckets;
}

export function buildMonthCalendarDays(
    anchorDate: Date,
    employees: Employee[],
    toIsoDate: (date: Date) => string,
    isSameDate: (left: Date, right: Date) => boolean
): MonthCalendarDay[] {
    const month = anchorDate.getMonth();
    const year = anchorDate.getFullYear();
    const firstDay = new Date(year, month, 1);
    const offsetFromMonday = (firstDay.getDay() + 6) % 7;
    const gridStartDate = new Date(year, month, 1 - offsetFromMonday);
    const today = new Date();
    const days: MonthCalendarDay[] = [];

    for (let index = 0; index < 42; index += 1) {
        const currentDate = new Date(gridStartDate);
        currentDate.setDate(gridStartDate.getDate() + index);
        const staff = buildStaffMembers(currentDate, employees);

        days.push({
            isoDate: toIsoDate(currentDate),
            dayNumber: currentDate.getDate(),
            isCurrentMonth: currentDate.getMonth() === month,
            assignedCount: staff.length,
            isToday: isSameDate(currentDate, today),
            staff
        });
    }

    return days;
}

function buildStaffMembers(date: Date, employees: Employee[]): DayStaffMember[] {
    const marker = getScheduleMarker(date);

    return employees
        .filter((employee) => isEmployeeScheduled(employee, marker))
        .map((employee) => {
            const workWindow = resolveWorkingHours(employee, marker);
            return {
                id: employee.id,
                name: employee.name,
                role: employee.role,
                startTime: workWindow.startTime,
                endTime: workWindow.endTime
            };
        });
}

function getScheduleMarker(date: Date): number {
    return date.getFullYear() * 400 + date.getMonth() * 31 + date.getDate();
}

function isEmployeeScheduled(employee: Employee, marker: number): boolean {
    if (!employee.active) {
        return false;
    }

    const seed = getEmployeeSeed(employee);

    if (employee.role === 'Quản lý') {
        return (marker + seed) % 7 !== 0;
    }

    if (employee.role === 'Part-time') {
        return (marker + seed) % 3 === 0;
    }

    return (marker + seed) % 5 !== 0;
}

function resolveWorkingHours(employee: Employee, marker: number): { startTime: string; endTime: string } {
    const seed = getEmployeeSeed(employee);
    const slot = (marker + seed) % 3;

    if (employee.role === 'Quản lý') {
        return slot === 0
            ? { startTime: '08:00', endTime: '17:00' }
            : { startTime: '09:00', endTime: '18:00' };
    }

    if (employee.role === 'Part-time') {
        return slot === 0
            ? { startTime: '13:00', endTime: '18:00' }
            : { startTime: '17:00', endTime: '21:00' };
    }

    if (slot === 0) {
        return { startTime: '08:00', endTime: '16:30' };
    }

    if (slot === 1) {
        return { startTime: '09:00', endTime: '17:30' };
    }

    return { startTime: '12:00', endTime: '20:30' };
}

function getEmployeeSeed(employee: Employee): number {
    const idSuffix = Number(employee.id.slice(-2));
    if (Number.isNaN(idSuffix)) {
        return employee.name.length + employee.role.length;
    }
    return idSuffix;
}
