// Sample data for the demo.
// The source text is copied word for word from two US government pages, fetched on 10 Nov 2026.
// The ANSWER below was written for this demo, not by a model and not by a clinician.
// Two errors were planted on purpose so the checker has something to catch.

export const question = "How do I interpret an elevated Lp(a) in a healthy 45-year-old?";
export const fetchedOn = "10 Nov 2026";

export const sources = [
  {
    id: "medlineplus",
    title: "Lipoprotein (a) Blood Test, MedlinePlus (US National Library of Medicine)",
    url: "https://medlineplus.gov/lab-tests/lipoprotein-a-blood-test/",
    text: [
      "A lipoprotein (a) test measures the level of lipoprotein (a) in your blood.",
      "A high level of lipoprotein (a) may mean you have a high risk for heart disease and stroke.",
      "Lipoprotein (a) particles are stickier than other types of LDL particles, so they may be more likely to cause blockages and blood clots in your arteries.",
      "A lipoprotein (a) test is used to get a better understanding of your risk for heart disease, stroke, and other blood vessel diseases.",
      "Researchers are still studying how lipoprotein (a) levels affect health and when the test should be used.",
      "Lipoprotein (a) levels usually don't change much over time.",
      "By age 5, you usually have your \"adult level\" of lipoprotein (a), and it tends to remain about the same for the rest of your life.",
      "For that reason, diet and exercise may not change your lipoprotein (a) levels.",
    ].join(" "),
  },
  {
    id: "nhlbi",
    title: "Blood cholesterol diagnosis, NHLBI (US National Institutes of Health)",
    url: "https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis",
    text: [
      "A lipoprotein-a, or Lp(a), test is not usually part of a routine lipid panel.",
      "High levels of Lp(a) may mean you are at higher risk of heart or blood vessel diseases, even if your other cholesterol levels are healthy.",
      "The genes you inherit from your parents determine how much Lp(a) you have.",
      "Your Lp(a) level is unlikely to change much from childhood to old age.",
      "Your healthcare provider may order an Lp(a) test if you have a family history of stroke, early heart disease, such as a heart attack, or do not know your family medical history.",
    ].join(" "),
  },
];

export const claims = [
  {
    // faithful
    text: "A high lipoprotein (a) level may mean a high risk for heart disease and stroke.",
    sourceId: "medlineplus",
    quote: "A high level of lipoprotein (a) may mean you have a high risk for heart disease and stroke.",
  },
  {
    // faithful
    text: "An Lp(a) test is not usually part of a routine lipid panel.",
    sourceId: "nhlbi",
    quote: "A lipoprotein-a, or Lp(a), test is not usually part of a routine lipid panel.",
  },
  {
    // faithful
    text: "Lp(a) particles are stickier than other types of LDL particles.",
    sourceId: "medlineplus",
    quote: "Lipoprotein (a) particles are stickier than other types of LDL particles",
  },
  {
    // faithful
    text: "The genes a person inherits determine how much Lp(a) they have.",
    sourceId: "nhlbi",
    quote: "The genes you inherit from your parents determine how much Lp(a) you have.",
  },
  {
    // PLANTED ERROR 1: one number in the quote was changed (the page says age 5).
    text: "People usually reach their adult level of lipoprotein (a) by age 15.",
    sourceId: "medlineplus",
    quote: "By age 15, you usually have your \"adult level\" of lipoprotein (a)",
  },
  {
    // PLANTED ERROR 2: the cited source id is not in the source set.
    text: "Lipoprotein (a) levels usually don't change much over time.",
    sourceId: "cdc",
    quote: "Lipoprotein (a) levels usually don't change much over time.",
  },
];
