/**
 * Simple Vector Utilities for Semantic Similarity Search.
 * Implementation focuses on TF-IDF style vectorization and Cosine Similarity.
 */

export type Vector = number[];

/**
 * Calculates Cosine Similarity between two vectors.
 * Returns a score between 0 and 1.
 */
export function calculateCosineSimilarity(a: Vector, b: Vector): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  
  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  
  if (mA === 0 || mB === 0) return 0;
  
  return dotProduct / (mA * mB);
}

/**
 * Simple Tokenizer that cleans and splits text.
 */
export function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2); // Filter out short stop-words
}

/**
 * Creates a term-frequency vector from text based on a fixed vocabulary.
 */
export function vectorize(text: string, vocabulary: string[]): Vector {
  const tokens = tokenize(text);
  const vector: Vector = new Array(vocabulary.length).fill(0);
  
  const tokenMap: Record<string, number> = {};
  tokens.forEach(t => {
    tokenMap[t] = (tokenMap[t] || 0) + 1;
  });
  
  vocabulary.forEach((word, i) => {
    vector[i] = tokenMap[word] || 0;
  });
  
  return vector;
}

/**
 * Build a vocabulary from a list of documents.
 * For production, this would be a fixed model-based vocabulary.
 */
export function buildVocabulary(docs: string[]): string[] {
  const set = new Set<string>();
  docs.forEach(doc => {
    tokenize(doc).forEach(t => set.add(t));
  });
  return Array.from(set);
}
