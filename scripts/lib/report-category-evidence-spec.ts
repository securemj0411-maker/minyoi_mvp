import {
  cameraCategoryEvidenceSpecs,
  desktopCategoryEvidenceSpecs,
  earphoneCategoryEvidenceSpecs,
  gameConsoleBodyCategoryEvidenceSpecs,
  gameConsoleBroadCategoryEvidenceSpecs,
  headphoneCategoryEvidenceSpecs,
  homeApplianceCategoryEvidenceSpecs,
  monitorCategoryEvidenceSpecs,
  speakerCategoryEvidenceSpecs,
  smartwatchCategoryEvidenceSpecs,
} from "./report-packet-registry";

export type ReportCategoryEvidenceMapping = {
  category: string;
  evidence: {
    file: string;
    role: string;
    metrics: string[];
  }[];
};

export const reportCategoryEvidenceSpecs: ReportCategoryEvidenceMapping[] = [
  { category: "earphone_discovered", evidence: earphoneCategoryEvidenceSpecs },
  { category: "headphone_discovered", evidence: headphoneCategoryEvidenceSpecs },
  { category: "monitor_discovered", evidence: monitorCategoryEvidenceSpecs },
  { category: "desktop_pc_discovered", evidence: desktopCategoryEvidenceSpecs },
  { category: "game_console_body_narrow", evidence: gameConsoleBodyCategoryEvidenceSpecs },
  { category: "game_console_discovered", evidence: gameConsoleBroadCategoryEvidenceSpecs },
  { category: "camera_discovered", evidence: cameraCategoryEvidenceSpecs },
  { category: "smartwatch_discovered", evidence: smartwatchCategoryEvidenceSpecs },
  { category: "speaker_audio_discovered", evidence: speakerCategoryEvidenceSpecs },
  { category: "home_appliance_tech_discovered", evidence: homeApplianceCategoryEvidenceSpecs },
];
