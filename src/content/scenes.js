// All words on the page. Owner: agent 05-page.
// Single source for copy: index.html holds only the shell, and
// src/content/page.render.js builds the sections from this file at load.
//
// Shape consumed by src/main.js (agents/CONTRACT.md section 8):
//   scenes: [{ id, line, copy, length, annotations: [{ id, anchor, text }] }]
//   formatScale(metres), formatCount(n)
//
// Extra fields used only by the page layer:
//   annotation.term   the leading words of `text`, set in a heavier weight
//   annotation.refs   keys into `references`; rendered as citation numbers
//   scene.readout     'scale' | 'count' (which live readout the scene carries)
//
// Every clinical or scientific statement here is in the fact table in
// agents/status/05-page.md with its source and supporting quote.

export const scenes = [
  {
    id: 'title',
    line: 'Editing the code',
    accent: 'code', // set in the helix's colours (page layer only)
    copy: 'How CRISPR-Cas9 finds one sequence among three billion letters, and what that means for sickle cell disease.',
    length: 100,
    annotations: [],
  },
  {
    id: 'problem',
    line: 'One letter changes the shape of a cell.',
    copy: 'In sickle cell disease a single substitution in the beta-globin gene makes hemoglobin stack into rigid fibers when it gives up oxygen. Red cells stiffen, bend into sickles and block small vessels.',
    length: 220,
    annotations: [
      {
        id: 'problem-hbb',
        anchor: 'cells.nearCell',
        term: 'HBB c.20A>T, p.Glu7Val',
        text: 'HBB c.20A>T, p.Glu7Val in HGVS numbering; Glu6Val in the legacy numbering. Deoxygenated HbS polymerizes into fibers.',
        refs: ['clinvar', 'papizan', 'eaton'],
      },
    ],
  },
  {
    id: 'spare',
    line: 'You were born with a second hemoglobin.',
    copy: 'Fetal hemoglobin keeps red cells from sickling. Around the time of birth a gene called BCL11A switches it off. Turn that switch back and the spare returns.',
    length: 320,
    readout: 'scale',
    annotations: [
      {
        id: 'spare-hbf',
        anchor: 'hemoglobin.fetal',
        term: 'Fetal hemoglobin (HbF)',
        text: 'Fetal hemoglobin (HbF) pairs two alpha chains with two gamma chains. Adult hemoglobin (HbA) has two beta chains in their place, and beta is the chain the sickle mutation alters.',
      },
      {
        id: 'spare-switch',
        anchor: 'nucleus.clearing',
        term: 'BCL11A',
        text: 'BCL11A represses γ-globin and so fetal hemoglobin (HbF). HbF lowers the HbS concentration inside the cell and prevents sickling.',
        refs: ['frangoul2021', 'label'],
      },
    ],
  },
  {
    id: 'library',
    line: 'Three billion letters. One address.',
    copy: 'The genome is a text written in four letters. The target here is a stretch of twenty.',
    length: 260,
    readout: 'count',
    annotations: [
      {
        id: 'library-genome',
        anchor: 'helix.top',
        term: '3.055 billion base pairs',
        text: '3.055 billion base pairs in the first complete sequence of a human genome, T2T-CHM13.',
        refs: ['nurk'],
      },
    ],
  },
  {
    id: 'reader',
    line: 'A protein that can read.',
    copy: 'Cas9 is an enzyme that cuts DNA. On its own it is blind. A short strand of guide RNA tells it which twenty letters to look for.',
    length: 260,
    annotations: [
      {
        id: 'reader-rnp',
        anchor: 'cas9.guideTip',
        term: 'Cas9–guide RNA ribonucleoprotein',
        text: 'Cas9–guide RNA ribonucleoprotein. For exa-cel it is delivered to the patient’s own CD34+ stem cells outside the body, by electroporation.',
        refs: ['jinek', 'label'],
      },
    ],
  },
  {
    id: 'search',
    line: 'It checks, and moves on.',
    copy: 'Cas9 only stops at a three-letter landmark. It samples site after site, staying less than a second at each wrong one.',
    length: 300,
    annotations: [
      {
        id: 'search-pam',
        anchor: 'helix.pam',
        term: 'PAM, 5′-NGG-3′',
        text: 'PAM, 5′-NGG-3′ for Streptococcus pyogenes Cas9. Without it a matching sequence is ignored. Off-target binding lasts under 1 second on average in living cells.',
        refs: ['sternberg', 'knight'],
      },
    ],
  },
  {
    id: 'match',
    line: 'Twenty letters decide.',
    copy: 'Beside a landmark the helix is pried open and the guide pairs with the DNA one letter at a time. An early mismatch and it lets go. A full match and it locks.',
    length: 340,
    annotations: [
      {
        id: 'match-rloop',
        anchor: 'helix.target',
        term: 'R-loop',
        text: 'R-loop. The RNA–DNA hybrid starts at the PAM and extends away from it. Cas9 tolerates some mismatches, depending on their number and position: the basis of off-target editing.',
        refs: ['sternberg', 'hsu'],
      },
    ],
  },
  {
    id: 'cut',
    line: 'Then it cuts.',
    copy: 'Two blades, one for each strand, three letters from the landmark.',
    length: 200,
    annotations: [
      {
        id: 'cut-hnh',
        anchor: 'cas9.hnh',
        term: 'HNH domain',
        text: 'HNH domain cleaves the target strand, the one paired with the guide.',
        refs: ['jinek', 'jiang'],
      },
      {
        id: 'cut-ruvc',
        anchor: 'cas9.ruvc',
        term: 'RuvC domain',
        text: 'RuvC domain cleaves the non-target strand. Together: a double-strand break 3 bp upstream of the PAM.',
        refs: ['jinek', 'jiang'],
      },
    ],
  },
  {
    id: 'repair',
    line: 'The cell repairs it badly. That is the point.',
    copy: 'The cell rejoins the ends in a hurry and drops or adds a few letters. Here that small scar lands on the switch that keeps fetal hemoglobin off.',
    length: 260,
    annotations: [
      {
        id: 'repair-nhej',
        anchor: 'helix.cutSite',
        term: 'NHEJ indels',
        text: 'NHEJ indels disrupt a GATA1 binding site in the erythroid-specific enhancer of BCL11A. The edit is in BCL11A, not HBB: the sickle variant itself is left unchanged.',
        refs: ['canver', 'papizan', 'label'],
      },
    ],
  },
  {
    id: 'payoff',
    line: 'The spare comes back on.',
    copy: 'Stem cells carrying the edit produce red cells rich in fetal hemoglobin. They stay round.',
    length: 320,
    annotations: [
      {
        id: 'payoff-hbf',
        anchor: 'cells.source',
        term: 'Pivotal trial, age 12 and over',
        text: 'Pivotal trial, age 12 and over. At month 6, HbF made up a mean 43.9% of hemoglobin, and 94.0% of circulating red cells contained it.',
        refs: ['label'],
      },
    ],
  },
  {
    id: 'practice',
    line: 'One infusion, and what it asks of the patient.',
    copy: 'Casgevy (exagamglogene autotemcel, or exa-cel) is the patient’s own blood stem cells, edited once and given back. The infusion is a single dose. Getting to it takes months and includes chemotherapy.',
    length: null,
    annotations: [],
  },
  {
    id: 'beyond',
    line: 'The next editors do not cut the helix in two.',
    copy: 'Base editors change one letter chemically. Prime editors write a short new sequence. Neither needs a double-strand break.',
    length: 220,
    annotations: [
      {
        id: 'beyond-editors',
        anchor: 'helix.editSite',
        term: 'Base and prime editing',
        text: 'Base and prime editing. A deaminase fused to Cas9 converts C to T (or G to A). A catalytically impaired Cas9 fused to a reverse transcriptase writes the sequence carried by its pegRNA.',
        refs: ['komor', 'anzalone'],
      },
    ],
  },
  {
    id: 'references',
    line: 'References',
    copy: '',
    length: null,
    annotations: [],
  },
];

// ---------------------------------------------------------------------------
// The `practice` section: ordinary content. All from the US prescribing
// information (reference `label`) unless a ref says otherwise.
// ---------------------------------------------------------------------------
export const practice = {
  steps: {
    heading: 'The treatment, in four steps',
    items: [
      {
        title: 'Collection',
        text: 'In sickle cell disease, after at least 8 weeks of red cell transfusions, stem cells are moved into the blood with plerixafor and collected by apheresis. One cycle is often not enough: the pivotal sickle cell trial needed a median of 2, and up to 6. A back-up of unedited cells is stored as well.',
      },
      {
        title: 'Editing',
        text: 'In the laboratory the CD34+ cells receive the Cas9–guide RNA complex by electroporation. The edited cells are frozen and shipped back to the treatment center. Manufacturing may take up to 6 months.',
      },
      {
        title: 'Conditioning',
        text: 'Full myeloablative chemotherapy empties the marrow to make room. In the trials this was busulfan, given into a central vein for 4 consecutive days. The infusion follows between 48 hours and 7 days after the last dose.',
      },
      {
        title: 'Infusion and engraftment',
        text: 'One intravenous dose of at least 3 × 10⁶ CD34+ cells per kg. The patient stays in hospital while the cells engraft and blood counts recover, which can take 4 to 6 weeks, though times vary.',
      },
    ],
  },
  evidence: {
    heading: 'Who it is for, and the evidence',
    indication:
      'In the United States, Casgevy is indicated for patients aged 2 years and older with sickle cell disease with recurrent vaso-occlusive crises, or with transfusion-dependent beta thalassemia.',
    columns: ['Patients', 'Outcome', 'Achieved by'],
    rows: [
      {
        group: 'Sickle cell disease, 12 years and older',
        outcome: 'No severe vaso-occlusive crisis for at least 12 consecutive months',
        result: '29 of 31',
        pct: '93.5%',
      },
      {
        group: 'Sickle cell disease, 12 years and older',
        outcome: 'No hospital admission for a severe crisis for at least 12 consecutive months',
        result: '30 of 30',
        pct: '100%',
      },
      {
        group: 'Sickle cell disease, 5 to under 12 years',
        outcome: 'No severe vaso-occlusive crisis for at least 12 consecutive months',
        result: '8 of 8',
        pct: '100%',
      },
      {
        group: 'Beta thalassemia, 12 years and older',
        outcome: 'Transfusion independent for at least 12 consecutive months',
        result: '32 of 35',
        pct: '91.4%',
      },
      {
        group: 'Beta thalassemia, 5 to under 12 years',
        outcome: 'Transfusion independent for at least 12 consecutive months',
        result: '8 of 9',
        pct: '89%',
      },
    ],
    notes: [
      'Open-label, single-arm trials. Patients were followed for 24 months after the infusion and can enter long-term follow-up to 15 years.',
      'Casgevy has not been studied in children under 5. Its use from age 2 to under 5 rests on extrapolation from these trials.',
      'Figures are from the US prescribing information, revised July 2026. The published sickle cell paper reports an earlier analysis of the same trial: 29 of 30 patients.',
    ],
    refs: ['label', 'frangoul2024', 'locatelli2024', 'fda2026'],
  },
  asks: {
    heading: 'What it asks of the patient',
    burden: [
      {
        term: 'Months of preparation',
        text: 'Hydroxyurea and crizanlizumab are stopped 8 weeks before collection. Red cell transfusions run for at least 8 weeks beforehand, aiming for HbS below 30% of hemoglobin.',
      },
      {
        term: 'Collection may fall short',
        text: 'In the pivotal sickle cell trial, 6 patients (10%) could not be treated because too few cells could be collected.',
      },
      {
        term: 'Chemotherapy',
        text: 'Every patient in the trials had grade 3 or 4 neutropenia and thrombocytopenia. Mucositis and febrile neutropenia were the most common severe reactions.',
      },
      {
        term: 'Fertility',
        text: 'Infertility has been observed with myeloablative conditioning. Fertility preservation should be discussed before treatment.',
      },
      {
        term: 'Deaths in the trials',
        text: 'One patient with sickle cell disease died of COVID-19 and respiratory failure, judged unrelated to Casgevy. One child with beta thalassemia developed hepatic veno-occlusive disease after busulfan conditioning and Casgevy, and died of pneumonia and multi-organ failure.',
      },
      {
        term: 'Afterwards',
        text: 'Patients should not donate blood, organs, tissues or cells at any time in the future.',
      },
    ],
    warningsHeading: 'Warnings in the label',
    warnings: [
      {
        term: 'Neutrophil engraftment failure',
        text: 'A potential risk. It did not occur in the trials, where neutrophils engrafted at a median of 26 to 31 days depending on age and disease. The stored back-up cells are the rescue.',
      },
      {
        term: 'Delayed platelet engraftment',
        text: 'Observed with Casgevy; medians ran from 32.5 to 51 days. The risk of bleeding is raised until platelets recover.',
      },
      {
        term: 'Hypersensitivity reactions',
        text: 'Including anaphylaxis, from the dimethyl sulfoxide or dextran 40 in the cryopreservation solution.',
      },
      {
        term: 'Off-target genome editing',
        text: 'Unintended editing in a patient’s cells cannot be ruled out because of genetic variants. Its clinical significance is unknown.',
      },
    ],
    refs: ['label'],
  },
};

// ---------------------------------------------------------------------------
// References, in the order they are numbered on the page.
// `html` may contain <i> for journal names; everything else is plain text.
// ---------------------------------------------------------------------------
export const references = [
  {
    key: 'label',
    html: 'Casgevy (exagamglogene autotemcel) suspension for intravenous infusion. US prescribing information. Vertex Pharmaceuticals Incorporated; revised July 2026. DailyMed, National Library of Medicine.',
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7c3e12ad-e2fe-4d3f-a630-ea7364d9e846',
  },
  {
    key: 'frangoul2024',
    html: 'Frangoul H, Locatelli F, Sharma A, et al. Exagamglogene autotemcel for severe sickle cell disease. <i>N Engl J Med</i> 2024;390:1649-1662.',
    url: 'https://doi.org/10.1056/NEJMoa2309676',
  },
  {
    key: 'locatelli2024',
    html: 'Locatelli F, Lang P, Wall D, et al. Exagamglogene autotemcel for transfusion-dependent β-thalassemia. <i>N Engl J Med</i> 2024;390:1663-1676.',
    url: 'https://doi.org/10.1056/NEJMoa2309673',
  },
  {
    key: 'frangoul2021',
    html: 'Frangoul H, Altshuler D, Cappellini MD, et al. CRISPR-Cas9 gene editing for sickle cell disease and β-thalassemia. <i>N Engl J Med</i> 2021;384:252-260.',
    url: 'https://doi.org/10.1056/NEJMoa2031054',
  },
  {
    key: 'fda2023',
    html: 'US Food and Drug Administration. FDA approves first gene therapies to treat patients with sickle cell disease. 8 December 2023.',
    url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapies-treat-patients-sickle-cell-disease',
  },
  {
    key: 'fda2024',
    html: 'US Food and Drug Administration. FDA roundup: January 16, 2024 (approval of Casgevy for transfusion-dependent beta thalassemia).',
    url: 'https://www.fda.gov/news-events/press-announcements/fda-roundup-january-16-2024',
  },
  {
    key: 'fda2026',
    html: 'US Food and Drug Administration. FDA approves first gene therapy for young children with sickle cell disease. 1 July 2026.',
    url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapy-young-children-sickle-cell-disease',
  },
  {
    key: 'clinvar',
    html: 'ClinVar. NM_000518.5(HBB):c.20A>T (p.Glu7Val), accession VCV000015333. National Center for Biotechnology Information.',
    url: 'https://www.ncbi.nlm.nih.gov/clinvar/variation/15333/',
  },
  {
    key: 'papizan',
    html: 'Papizan JB, Porter SN, Sharma A, Pruett-Miller SM. Therapeutic gene editing strategies using CRISPR-Cas9 for the β-hemoglobinopathies. <i>J Biomed Res</i> 2020;35:115-134.',
    url: 'https://doi.org/10.7555/JBR.34.20200096',
  },
  {
    key: 'eaton',
    html: 'Eaton WA, Bunn HF. Treating sickle cell disease by targeting HbS polymerization. <i>Blood</i> 2017;129:2719-2726.',
    url: 'https://doi.org/10.1182/blood-2017-02-765891',
  },
  {
    key: 'gene',
    html: 'NCBI Gene. BCL11A, BCL11 transcription factor A (Gene ID 53335), location 2p16.1. National Center for Biotechnology Information.',
    url: 'https://www.ncbi.nlm.nih.gov/gene/53335',
  },
  {
    key: 'nurk',
    html: 'Nurk S, Koren S, Rhie A, et al. The complete sequence of a human genome. <i>Science</i> 2022;376:44-53.',
    url: 'https://doi.org/10.1126/science.abj6987',
  },
  {
    key: 'jinek',
    html: 'Jinek M, Chylinski K, Fonfara I, Hauer M, Doudna JA, Charpentier E. A programmable dual-RNA-guided DNA endonuclease in adaptive bacterial immunity. <i>Science</i> 2012;337:816-821.',
    url: 'https://doi.org/10.1126/science.1225829',
  },
  {
    key: 'sternberg',
    html: 'Sternberg SH, Redding S, Jinek M, Greene EC, Doudna JA. DNA interrogation by the CRISPR RNA-guided endonuclease Cas9. <i>Nature</i> 2014;507:62-67.',
    url: 'https://doi.org/10.1038/nature13011',
  },
  {
    key: 'knight',
    html: 'Knight SC, Xie L, Deng W, et al. Dynamics of CRISPR-Cas9 genome interrogation in living cells. <i>Science</i> 2015;350:823-826.',
    url: 'https://doi.org/10.1126/science.aac6572',
  },
  {
    key: 'hsu',
    html: 'Hsu PD, Scott DA, Weinstein JA, et al. DNA targeting specificity of RNA-guided Cas9 nucleases. <i>Nat Biotechnol</i> 2013;31:827-832.',
    url: 'https://doi.org/10.1038/nbt.2647',
  },
  {
    key: 'jiang',
    html: 'Jiang F, Taylor DW, Chen JS, et al. Structures of a CRISPR-Cas9 R-loop complex primed for DNA cleavage. <i>Science</i> 2016;351:867-871.',
    url: 'https://doi.org/10.1126/science.aad8282',
  },
  {
    key: 'canver',
    html: 'Canver MC, Smith EC, Sher F, et al. BCL11A enhancer dissection by Cas9-mediated in situ saturating mutagenesis. <i>Nature</i> 2015;527:192-197.',
    url: 'https://doi.org/10.1038/nature15521',
  },
  {
    key: 'komor',
    html: 'Komor AC, Kim YB, Packer MS, Zuris JA, Liu DR. Programmable editing of a target base in genomic DNA without double-stranded DNA cleavage. <i>Nature</i> 2016;533:420-424.',
    url: 'https://doi.org/10.1038/nature17946',
  },
  {
    key: 'anzalone',
    html: 'Anzalone AV, Randolph PB, Davis JR, et al. Search-and-replace genome editing without double-strand breaks or donor DNA. <i>Nature</i> 2019;576:149-157.',
    url: 'https://doi.org/10.1038/s41586-019-1711-4',
  },
  {
    key: 'structure',
    // Confirmed by 02-cas9: chain B residues 3-1364, sgRNA chain A.
    html: 'Protein Data Bank entry 5F9R: Streptococcus pyogenes Cas9 in complex with single-guide RNA and double-stranded DNA primed for target DNA cleavage (Jiang et al., reference 17). The Cas9 model on this site is derived from this structure.',
    url: 'https://www.rcsb.org/structure/5F9R',
  },
];

export const closingNote =
  'This site is educational and non-promotional. It is not affiliated with or endorsed by the manufacturers of any product it describes, and it is not medical advice. Its molecular and cellular models are schematic and not to scale.';

export const approvals =
  'Casgevy was first approved in the United States for sickle cell disease on 8 December 2023 and for transfusion-dependent beta thalassemia on 16 January 2024, for patients aged 12 and older. The indication was extended to patients aged 2 and older on 1 July 2026.';

/** 1-based citation number of a reference key. */
export function refNumber(key) {
  const i = references.findIndex((r) => r.key === key);
  return i < 0 ? null : i + 1;
}

// ---------------------------------------------------------------------------
// Readout formatting.
// ---------------------------------------------------------------------------
const UNITS = [
  [1, 'm'],
  [1e-3, 'mm'],
  [1e-6, 'µm'],
  [1e-9, 'nm'],
  [1e-12, 'pm'],
];

/** Short human length: 6e-6 -> "6 µm", 4.3e-7 -> "430 nm", 2e-9 -> "2 nm". */
export function formatScale(metres) {
  if (!Number.isFinite(metres) || metres <= 0) return '0 nm';
  let [size, unit] = UNITS[UNITS.length - 1];
  for (const [s, u] of UNITS) {
    // Tolerance keeps 5.9999e-6 in micrometres rather than 5999.9 nm.
    if (metres >= s * 0.9995) {
      size = s;
      unit = u;
      break;
    }
  }
  const v = metres / size;
  let text;
  if (v >= 100) text = String(Math.round(v / 10) * 10);
  else if (v >= 10) text = String(Math.round(v));
  else text = String(Math.round(v * 10) / 10);
  if (text === '1000' && unit !== 'm') return formatScale(size * 1000);
  return `${text} ${unit}`;
}

/** Grouped integer: 3055000000 -> "3,055,000,000". */
export function formatCount(n) {
  if (!Number.isFinite(n)) return '0';
  return Math.max(0, Math.round(n)).toLocaleString('en-US');
}
