export interface MockBook {
  title: string;
  author: string;
  isbn: string;
  tableOfContents: string[];
  summary: string;
}

export const MOCK_LIBRARY_CATALOG: MockBook[] = [
  {
    title: 'Introduction to Axiomatic Set Theory',
    author: 'G. Takeuti',
    isbn: '9780387900247',
    summary:
      'A foundational text exploring Zermelo-Fraenkel set theory, ordinal numbers, and the axiom of choice.',
    tableOfContents: [
      'Chapter 1: Axioms of Set Theory and Relations',
      'Chapter 2: Ordinal Numbers and Transfinite Induction',
      'Chapter 3: Cardinal Numbers and the Axiom of Choice',
      'Chapter 4: The Independence of the Continuum Hypothesis',
    ],
  },
  {
    title: 'Topology and Set Theory',
    author: 'S. Warner',
    isbn: '9780486824499',
    summary:
      'An accessible guide combining foundational abstract set theory with introductory general topology.',
    tableOfContents: [
      'Chapter 1: Sets and Direct Products',
      'Chapter 2: Equivalences and Functions',
      'Chapter 3: Topological Spaces and Metric Spaces',
      'Chapter 4: Compactness and Connectedness',
    ],
  },
];
