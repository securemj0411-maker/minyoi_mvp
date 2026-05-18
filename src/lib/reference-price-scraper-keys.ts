// 2026-05-15: 다나와 검색용 comparable_key → label list.
// reference-price-scraper의 KEY_TO_QUERY와 sync 유지.

export const KEY_TO_QUERY_LIST: Array<{ comparableKey: string; label: string }> = [
  // AirPods
  { comparableKey: "airpods|airpods_4|usbc|anc", label: "에어팟 4세대 ANC" },
  { comparableKey: "airpods|airpods_4|usbc|no_anc", label: "에어팟 4세대" },
  { comparableKey: "airpods|airpods_4_anc|usbc", label: "에어팟 4세대 ANC" },
  { comparableKey: "airpods|airpods_max|usbc", label: "에어팟 맥스 USB-C" },
  { comparableKey: "airpods|airpods_max|lightning", label: "에어팟 맥스" },
  { comparableKey: "airpods|airpods_pro_2", label: "에어팟 프로 2세대 USB-C" },
  { comparableKey: "airpods|airpods_pro_2_lightning|lightning", label: "에어팟 프로 2세대" },
  { comparableKey: "airpods|airpods_pro_2_usbc|usbc", label: "에어팟 프로 2세대 USB-C" },
  { comparableKey: "airpods|airpods_pro_3|usbc", label: "에어팟 프로 3세대" },
  { comparableKey: "airpods|airpods_pro_1|lightning", label: "에어팟 프로 1세대" },
  // iPad
  { comparableKey: "ipad|ipad_10|10_9in|64gb|wifi", label: "아이패드 10세대 64GB Wi-Fi" },
  { comparableKey: "ipad|ipad_10|10_9in|256gb|wifi", label: "아이패드 10세대 256GB Wi-Fi" },
  { comparableKey: "ipad|ipad_mini|7_gen|8_3in|128gb|wifi", label: "아이패드 미니 7세대 128GB Wi-Fi" },
  { comparableKey: "ipad|ipad_mini|6_gen|8_3in|64gb|wifi", label: "아이패드 미니 6세대 64GB Wi-Fi" },
  { comparableKey: "ipad|ipad_air|m4|11in|128gb|wifi", label: "아이패드 에어 M4 11인치 128GB Wi-Fi" },
  { comparableKey: "ipad|ipad_air|m3|11in|128gb|wifi", label: "아이패드 에어 M3 11인치 128GB Wi-Fi" },
  { comparableKey: "ipad|ipad_pro|m5|11in|256gb|wifi", label: "아이패드 프로 M5 11인치 256GB Wi-Fi" },
  { comparableKey: "ipad|ipad_pro|m5|13in|256gb|wifi", label: "아이패드 프로 M5 13인치 256GB Wi-Fi" },
  // iPhone
  { comparableKey: "iphone|iphone_16e|128gb", label: "아이폰 16e 128GB" },
  { comparableKey: "iphone|iphone_16|128gb", label: "아이폰 16 128GB" },
  { comparableKey: "iphone|iphone_16_pro_max|256gb", label: "아이폰 16 Pro Max 256GB" },
  { comparableKey: "iphone|iphone_16_pro_max|512gb", label: "아이폰 16 Pro Max 512GB" },
  { comparableKey: "iphone|iphone_15_pro_max|256gb", label: "아이폰 15 Pro Max 256GB" },
  { comparableKey: "iphone|iphone_14|128gb", label: "아이폰 14 128GB" },
  // Apple Watch
  { comparableKey: "applewatch|applewatch_se3|40mm|gps", label: "애플워치 SE 3세대 40mm GPS" },
  { comparableKey: "applewatch|applewatch_se3|44mm|gps", label: "애플워치 SE 3세대 44mm GPS" },
  { comparableKey: "applewatch|applewatch_se2|40mm|gps", label: "애플워치 SE 2세대 40mm GPS" },
  { comparableKey: "applewatch|applewatch_se2|44mm|gps", label: "애플워치 SE 2세대 44mm GPS" },
  { comparableKey: "applewatch|applewatch_series9|41mm|gps", label: "애플워치 시리즈 9 41mm GPS" },
  { comparableKey: "applewatch|applewatch_series10|46mm|gps", label: "애플워치 시리즈 10 46mm GPS" },
  { comparableKey: "applewatch|applewatch_series10|42mm|gps", label: "애플워치 시리즈 10 42mm GPS" },
  { comparableKey: "applewatch|applewatch_ultra|49mm|cellular", label: "애플워치 울트라 1세대 49mm 셀룰러" },
  { comparableKey: "applewatch|applewatch_ultra2|49mm|cellular", label: "애플워치 울트라 2 49mm 셀룰러" },
  // Galaxy
  { comparableKey: "galaxy_s|galaxy_s25|256gb", label: "갤럭시 S25 256GB" },
  { comparableKey: "galaxy_s|galaxy_s24_ultra|512gb", label: "갤럭시 S24 Ultra 512GB" },
  { comparableKey: "galaxywatch|galaxywatch_ultra|47mm|cellular", label: "갤럭시 워치 울트라 47mm LTE" },
  { comparableKey: "galaxywatch|galaxywatch_ultra|47mm|gps", label: "갤럭시 워치 울트라 47mm GPS" },
  { comparableKey: "galaxywatch|galaxywatch_7|44mm|gps", label: "갤럭시 워치 7 44mm GPS" },
  { comparableKey: "galaxywatch|galaxywatch_7|40mm|gps", label: "갤럭시 워치 7 40mm GPS" },
  { comparableKey: "galaxywatch|galaxywatch_6|40mm|gps", label: "갤럭시 워치 6 40mm GPS" },
  { comparableKey: "galaxy_tab|galaxy_tab_s10_ultra|14_6in|256gb|wifi", label: "갤럭시 탭 S10 Ultra 256GB Wi-Fi" },
  { comparableKey: "galaxy_tab|galaxy_tab_s10_plus|12_4in|256gb|wifi", label: "갤럭시 탭 S10+ 256GB Wi-Fi" },
  { comparableKey: "galaxy_tab|galaxy_tab_s9_fe_plus|12_4in|128gb|wifi", label: "갤럭시 탭 S9 FE+ 128GB Wi-Fi" },
  // MacBook
  { comparableKey: "macbook|macbook_air|m5_gen|m5|13in|16gb_ram|512gb_ssd", label: "맥북 에어 M5 13인치 16GB 512GB" },
  // Earphone / Speaker / Casio
  { comparableKey: "earphone|galaxy_buds_3_pro", label: "갤럭시 버즈 3 프로" },
  { comparableKey: "earphone|sony_wh_ch520", label: "소니 WH-CH520" },
  { comparableKey: "earphone|beats_solo_4", label: "비츠 솔로 4" },
  { comparableKey: "casio|gshock_dw5600", label: "지샥 DW-5600" },
  { comparableKey: "casio|gshock_ga2100", label: "지샥 GA-2100" },
  { comparableKey: "speaker|marshall_emberton_ii|portable_bluetooth_speaker", label: "마샬 엠버튼 2" },
];
