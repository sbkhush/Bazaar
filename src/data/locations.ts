export interface PakistanLocation {
  city: string;
  district: string;
  province: string;
  country: 'Pakistan';
}

export const PAKISTAN_LOCATIONS: PakistanLocation[] = [
  { city: 'Karachi', district: 'Karachi', province: 'Sindh', country: 'Pakistan' },
  { city: 'Lahore', district: 'Lahore', province: 'Punjab', country: 'Pakistan' },
  { city: 'Islamabad', district: 'Islamabad Capital Territory', province: 'ICT', country: 'Pakistan' },
  { city: 'Rawalpindi', district: 'Rawalpindi', province: 'Punjab', country: 'Pakistan' },
  { city: 'Faisalabad', district: 'Faisalabad', province: 'Punjab', country: 'Pakistan' },
  { city: 'Multan', district: 'Multan', province: 'Punjab', country: 'Pakistan' },
  { city: 'Peshawar', district: 'Peshawar', province: 'Khyber Pakhtunkhwa', country: 'Pakistan' },
  { city: 'Quetta', district: 'Quetta', province: 'Balochistan', country: 'Pakistan' },
  { city: 'Sialkot', district: 'Sialkot', province: 'Punjab', country: 'Pakistan' },
  { city: 'Gujranwala', district: 'Gujranwala', province: 'Punjab', country: 'Pakistan' },
  { city: 'Hyderabad', district: 'Hyderabad', province: 'Sindh', country: 'Pakistan' },
  { city: 'Abbottabad', district: 'Abbottabad', province: 'Khyber Pakhtunkhwa', country: 'Pakistan' },
  { city: 'Bahawalpur', district: 'Bahawalpur', province: 'Punjab', country: 'Pakistan' },
  { city: 'Sargodha', district: 'Sargodha', province: 'Punjab', country: 'Pakistan' },
  { city: 'Sukkur', district: 'Sukkur', province: 'Sindh', country: 'Pakistan' },
  { city: 'Larkana', district: 'Larkana', province: 'Sindh', country: 'Pakistan' },
  { city: 'Sheikhupura', district: 'Sheikhupura', province: 'Punjab', country: 'Pakistan' },
  { city: 'Rahim Yar Khan', district: 'Rahim Yar Khan', province: 'Punjab', country: 'Pakistan' },
  { city: 'Jhang', district: 'Jhang', province: 'Punjab', country: 'Pakistan' },
  { city: 'Dera Ghazi Khan', district: 'Dera Ghazi Khan', province: 'Punjab', country: 'Pakistan' },
  { city: 'Gujrat', district: 'Gujrat', province: 'Punjab', country: 'Pakistan' },
  { city: 'Sahiwal', district: 'Sahiwal', province: 'Punjab', country: 'Pakistan' },
  { city: 'Chichawatni', district: 'Sahiwal', province: 'Punjab', country: 'Pakistan' },
  { city: 'Wah Cantt', district: 'Rawalpindi', province: 'Punjab', country: 'Pakistan' },
  { city: 'Mardan', district: 'Mardan', province: 'Khyber Pakhtunkhwa', country: 'Pakistan' },
  { city: 'Kasur', district: 'Kasur', province: 'Punjab', country: 'Pakistan' },
  { city: 'Okara', district: 'Okara', province: 'Punjab', country: 'Pakistan' },
  { city: 'Mingora', district: 'Swat', province: 'Khyber Pakhtunkhwa', country: 'Pakistan' },
  { city: 'Nawabshah', district: 'Shaheed Benazirabad', province: 'Sindh', country: 'Pakistan' },
  { city: 'Chiniot', district: 'Chiniot', province: 'Punjab', country: 'Pakistan' },
  { city: 'Kotri', district: 'Jamshoro', province: 'Sindh', country: 'Pakistan' },
  { city: 'Mirpur Khas', district: 'Mirpur Khas', province: 'Sindh', country: 'Pakistan' },
  { city: 'Kohat', district: 'Kohat', province: 'Khyber Pakhtunkhwa', country: 'Pakistan' },
  { city: 'Dera Ismail Khan', district: 'Dera Ismail Khan', province: 'Khyber Pakhtunkhwa', country: 'Pakistan' },
  { city: 'Muzaffargarh', district: 'Muzaffargarh', province: 'Punjab', country: 'Pakistan' },
  { city: 'Mandi Bahauddin', district: 'Mandi Bahauddin', province: 'Punjab', country: 'Pakistan' },
  { city: 'Jhelum', district: 'Jhelum', province: 'Punjab', country: 'Pakistan' },
  { city: 'Attock', district: 'Attock', province: 'Punjab', country: 'Pakistan' },
  { city: 'Vehari', district: 'Vehari', province: 'Punjab', country: 'Pakistan' },
  { city: 'Chakwal', district: 'Chakwal', province: 'Punjab', country: 'Pakistan' },
  { city: 'Mirpur (AJK)', district: 'Mirpur', province: 'Azad Jammu & Kashmir', country: 'Pakistan' },
  { city: 'Muzaffarabad (AJK)', district: 'Muzaffarabad', province: 'Azad Jammu & Kashmir', country: 'Pakistan' },
  { city: 'Gilgit', district: 'Gilgit', province: 'Gilgit-Baltistan', country: 'Pakistan' },
  { city: 'Skardu', district: 'Skardu', province: 'Gilgit-Baltistan', country: 'Pakistan' },
];

export const PAKISTAN_CITY_NAMES: string[] = PAKISTAN_LOCATIONS.map((loc) => loc.city);

export function getPakistanLocation(city?: string): PakistanLocation | undefined {
  const clean = String(city || '').trim().toLowerCase();
  if (!clean) return undefined;
  return PAKISTAN_LOCATIONS.find((loc) => loc.city.toLowerCase() === clean);
}

export function isKnownPakistanCity(city?: string): boolean {
  return Boolean(getPakistanLocation(city));
}

export function searchPakistanLocations(query: string): PakistanLocation[] {
  const clean = String(query || '').trim().toLowerCase();
  if (!clean) return PAKISTAN_LOCATIONS;
  return PAKISTAN_LOCATIONS.filter(
    (loc) =>
      loc.city.toLowerCase().includes(clean) ||
      loc.district.toLowerCase().includes(clean) ||
      loc.province.toLowerCase().includes(clean)
  );
}
