import type { PatientMode } from "../types";

export const APPROPRIATE_USE_GUIDE = {
  title: "抗微生物薬適正使用の手引き 第四版",
  publisher: "厚生労働省",
  edition: "第四版",
  outpatient: "医科・外来編",
  inpatient: "医科・入院編",
  url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000120172.html",
} as const;

export type IncubationRow = {
  organism: string;
  food: string;
  incubation: string;
};

export const DIARRHEA_INCUBATION: IncubationRow[] = [
  { organism: "セレウス菌", food: "米飯・麺類、弁当類、調理パン等", incubation: "1～2時間" },
  { organism: "黄色ブドウ球菌", food: "にぎりめし、寿司、肉・卵・乳の加工品、菓子類等", incubation: "2～6時間" },
  { organism: "ボツリヌス菌", food: "缶詰、瓶詰、真空パック食品、いずし等", incubation: "18～36時間" },
  { organism: "腸管毒素原性大腸菌", food: "特定の食品なし。旅行者下痢症の主要な原因菌", incubation: "12～72時間" },
  { organism: "ノロウイルス", food: "牡蠣等の二枚貝", incubation: "12～48時間" },
  { organism: "腸炎ビブリオ", food: "魚介類（刺身、寿司、魚介加工品）", incubation: "2～48時間" },
  { organism: "エルシニア属菌", food: "加工乳、汚染水、生の豚肉から二次汚染された食品", incubation: "2～144時間" },
  { organism: "ウェルシュ菌", food: "カレー、シチュー、複合調理食品", incubation: "8～22時間" },
  { organism: "サルモネラ属菌", food: "卵、食肉、うなぎ、すっぽん等", incubation: "12～48時間" },
  { organism: "腸管出血性大腸菌", food: "生又は加熱不十分な牛肉", incubation: "1～7日間" },
  { organism: "カンピロバクター・ジェジュニ", food: "生又は加熱不十分な鶏肉、バーベキュー・焼き肉等", incubation: "2～7日間" },
];

export const ACUTE_DIARRHEA = {
  id: "acute-diarrhea",
  title: "急性下痢症",
  summary: {
    adult: "急性発症（14日以内）で、普段より軟便・水様便が1日3回以上増加した状態。多くは自然軽快します。",
    pediatric: "便性・便量の急な異常。小児では原因診断よりも重症度、特に脱水の評価が重要です。",
  } satisfies Record<PatientMode, string>,
  adult: {
    assessment: [
      "発症時期、発熱・腹痛・血便、摂食歴、海外渡航歴、最近の抗菌薬投与歴、免疫不全、周囲の発症者を確認する。",
      "高熱、血便・粘血便、強い腹痛、しぶり腹は細菌性腸炎を疑う所見となる。症状だけで急性胃腸炎と決めつけず、腸管外疾患も鑑別する。",
      "中等症～重症、長引く下痢、抗菌薬を投与する症例では便培養を検討する。",
    ],
    treatment: [
      "まず水分摂取を励行し、基本的には対症療法を行う。可能な限り経口で、糖分と電解質を含む飲料を摂取する。",
      "重症例又は海外渡航後の下痢症を除き、抗菌薬投与は原則として推奨されない。",
    ],
    considerAntibiotics: [
      "血圧低下、悪寒戦慄など菌血症が疑われる場合",
      "重度の脱水やショックで入院加療が必要な場合",
      "細胞性免疫不全など菌血症リスクが高い場合",
      "50歳以上、人工血管・人工弁・人工関節など合併症リスクが高い場合",
      "渡航者下痢症",
    ],
    notes: [
      "健常者の軽症サルモネラ腸炎、軽症カンピロバクター腸炎では抗菌薬を投与しないことが推奨される。",
      "EHEC腸炎では抗菌薬がHUS発症リスクを高める可能性があり、安易な投与を避ける。",
      "抗菌薬を検討する場合は、便培養等の検査と感染症・渡航医学の専門家への相談を考慮する。",
    ],
    pages: [36, 37, 38, 39, 40, 41, 42, 43],
  },
  pediatric: {
    assessment: [
      "嘔吐で始まり、水様下痢、軽度～中等度の腹痛、発熱なし又は微熱、周囲の同様症状はウイルス性を示唆する。",
      "発熱、しぶり腹、血便は細菌性腸炎を疑う。年少児の血便は重症疾患の可能性があり、原則として入院精査を検討する。",
      "激しい腹痛・血便、EHECからHUSが疑われる場合、免疫不全児では便培養を検討する。",
    ],
    treatment: [
      "原因診断より先に脱水の有無と重症度を評価し、早期に経口補水療法を開始する。必要時は経静脈的輸液を行う。",
      "ウイルス性では抗菌薬は無効で、腸内細菌叢を乱すため使用しない。健常児の軽症細菌性腸炎も、まず対症療法と経過観察を行う。",
    ],
    considerAntibiotics: [
      "細菌性腸炎を疑う強い腹痛、しぶり腹、血便、高熱がある場合",
      "生後3か月未満の場合",
      "免疫不全がある場合",
      "全身状態が不良で、敗血症合併が懸念される場合",
    ],
    notes: [
      "生後3か月未満、免疫不全、重症例は原則入院で全身管理と抗菌薬治療を検討する。",
      "カンピロバクター腸炎は自然治癒が望めるため抗菌薬は必須ではない。高熱、強い腹痛、血便等の重症例で検討する。",
      "非チフス性サルモネラ腸炎では軽症患者に投与しない。EHECでは統一見解がなく、適正使用の手引きは支持療法と慎重な経過観察を推奨している。",
    ],
    pages: [78, 79, 80, 81, 82],
  },
} as const;

export type HospitalOrganism = {
  label: string;
  organismId?: string;
  note?: string;
};

export type HospitalInfectionRow = {
  infection: string;
  organisms: HospitalOrganism[];
};

export const HOSPITAL_ONSET = {
  id: "hospital-onset",
  title: "院内発症感染症",
  intro: "この表は院内で頻度の高い感染症で問題となる代表的な原因微生物を示したもので、市中感染の原因微生物を示す表ではありません。",
  rows: [
    {
      infection: "血流感染症（BSI）",
      organisms: [
        { label: "表皮ブドウ球菌", organismId: "s_epidermidis_total" },
        { label: "黄色ブドウ球菌", organismId: "s_aureus_total" },
        { label: "グラム陰性桿菌", note: "複数菌を含む総称のため菌種別一覧で確認" },
        { label: "カンジダ", note: "当院アンチバイオグラムに収載なし" },
      ],
    },
    {
      infection: "尿路感染症（UTI）",
      organisms: [
        { label: "大腸菌", organismId: "e_coli_total" },
        { label: "緑膿菌", organismId: "p_aeruginosa" },
        { label: "腸球菌（Enterococcus faecalis等）", organismId: "e_faecalis" },
        { label: "肺炎桿菌", organismId: "k_pneumoniae_total" },
      ],
    },
    {
      infection: "肺炎（VAPを含む）",
      organisms: [
        { label: "緑膿菌", organismId: "p_aeruginosa" },
        { label: "黄色ブドウ球菌", organismId: "s_aureus_total" },
        { label: "Enterobacter cloacae", organismId: "e_cloacae" },
        { label: "肺炎桿菌", organismId: "k_pneumoniae_total" },
        { label: "口腔内常在菌", note: "複数菌を含む総称のため菌種別一覧で確認" },
      ],
    },
    {
      infection: "創部感染症",
      organisms: [
        { label: "表層：黄色ブドウ球菌", organismId: "s_aureus_total" },
        { label: "表層：表皮ブドウ球菌", organismId: "s_epidermidis_total" },
        { label: "深部：腸球菌（Enterococcus faecalis等）", organismId: "e_faecalis" },
        { label: "深部：黄色ブドウ球菌", organismId: "s_aureus_total" },
        { label: "深部・体腔臓器：グラム陰性桿菌", note: "複数菌を含む総称のため菌種別一覧で確認" },
        { label: "体腔臓器：嫌気性菌", note: "複数菌を含む総称のため菌種別一覧で確認" },
        { label: "体腔臓器：腸球菌", organismId: "e_faecalis" },
        { label: "体腔臓器：カンジダ", note: "当院アンチバイオグラムに収載なし" },
      ],
    },
  ] satisfies HospitalInfectionRow[],
  cautions: [
    "尿培養で黄色ブドウ球菌が検出された場合、UTIではなく菌血症が先行している可能性も考える。",
    "経験的治療は患者の重症度、培養結果、院内の薬剤耐性頻度、ASTの推奨を踏まえて選択する。",
    "ここでは抗菌薬の投与期間を提示しない。投与期間は患者背景、感染臓器、原因微生物、合併症、ソースコントロール、治療反応を総合して決定する。",
  ],
  page: 24,
} as const;
