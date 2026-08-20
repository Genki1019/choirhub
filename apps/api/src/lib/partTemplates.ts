export type PartTemplateKey = "mixed4" | "women3" | "mens4" | "custom";

type PartTemplatePart = {
  name: string;
  voiceType: string;
  sortOrder: number;
  isCustom: boolean;
};

export const PART_TEMPLATES: Record<PartTemplateKey, { label: string; parts: PartTemplatePart[] }> =
  {
    mixed4: {
      label: "混声四部",
      parts: [
        { name: "ソプラノ", voiceType: "soprano", sortOrder: 1, isCustom: false },
        { name: "アルト", voiceType: "alto", sortOrder: 2, isCustom: false },
        { name: "テナー", voiceType: "tenor", sortOrder: 3, isCustom: false },
        { name: "バス", voiceType: "bass", sortOrder: 4, isCustom: false },
      ],
    },
    women3: {
      label: "女声三部",
      parts: [
        { name: "ソプラノ I", voiceType: "soprano-1", sortOrder: 1, isCustom: false },
        { name: "ソプラノ II", voiceType: "soprano-2", sortOrder: 2, isCustom: false },
        { name: "アルト", voiceType: "alto", sortOrder: 3, isCustom: false },
      ],
    },
    mens4: {
      label: "男声四部",
      parts: [
        { name: "テナー I", voiceType: "tenor-1", sortOrder: 1, isCustom: false },
        { name: "テナー II", voiceType: "tenor-2", sortOrder: 2, isCustom: false },
        { name: "バリトン", voiceType: "baritone", sortOrder: 3, isCustom: false },
        { name: "バス", voiceType: "bass", sortOrder: 4, isCustom: false },
      ],
    },
    custom: {
      label: "カスタム（あとで手動設定）",
      parts: [],
    },
  };
