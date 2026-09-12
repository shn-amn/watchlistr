export const getMonthName = (m: string): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(m, 10) - 1;
  return months[idx] || m;
};

export const getDaysInMonth = (yearStr: string, monthStr: string): number => {
  if (!yearStr || !monthStr) return 31;
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  if (isNaN(y) || isNaN(m)) return 31;
  return new Date(y, m, 0).getDate();
};

export const getDayOptions = (yearStr: string, monthStr: string): { value: string; label: string }[] => {
  const daysCount = getDaysInMonth(yearStr, monthStr);
  const options: { value: string; label: string }[] = [];
  for (let i = 1; i <= daysCount; i++) {
    const val = i.toString().padStart(2, '0');
    options.push({ value: val, label: i.toString() });
  }
  return options;
};

export const getYearOptions = (selectedYear?: string): string[] => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear; y >= 1900; y--) {
    years.push(y.toString());
  }
  if (selectedYear && !years.includes(selectedYear) && !isNaN(parseInt(selectedYear, 10))) {
    years.unshift(selectedYear);
  }
  return years;
};
