/**
 * Import Mapping Storage Utility
 * Manages saving and loading of import mapping templates
 */

import { ImportMappingTemplate, ColumnMapping } from '../types/import';
import { warn, error as logError } from './logger';
import { calculateSimilarity } from './columnDetection';

const STORAGE_KEY = 'trade_import_mappings';
const MAX_TEMPLATES = 50; // Limit to prevent storage overflow

/**
 * Load all saved mapping templates from localStorage
 */
export function loadMappingTemplates(): ImportMappingTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const templates = JSON.parse(stored) as ImportMappingTemplate[];

    // Parse date strings back to Date objects
    return templates.map(template => ({
      ...template,
      createdAt: new Date(template.createdAt),
      lastUsed: template.lastUsed ? new Date(template.lastUsed) : undefined
    }));
  } catch (err) {
    logError('Failed to load mapping templates:', err);
    return [];
  }
}

/**
 * Save a mapping template to localStorage
 */
export function saveMappingTemplate(
  name: string,
  columnMappings: ColumnMapping[],
  fileColumns: string[],
  description?: string
): ImportMappingTemplate {
  try {
    const templates = loadMappingTemplates();

    // Check for duplicate name
    const existingIndex = templates.findIndex(t => t.name === name);

    const newTemplate: ImportMappingTemplate = {
      id: existingIndex >= 0 ? templates[existingIndex].id : crypto.randomUUID(),
      name,
      description,
      createdAt: existingIndex >= 0 ? templates[existingIndex].createdAt : new Date(),
      lastUsed: new Date(),
      columnMappings,
      fileColumns
    };

    // Update or add template
    if (existingIndex >= 0) {
      templates[existingIndex] = newTemplate;
    } else {
      templates.push(newTemplate);
    }

    // Limit number of templates
    if (templates.length > MAX_TEMPLATES) {
      // Remove oldest unused templates
      templates.sort((a, b) => {
        const aDate = a.lastUsed || a.createdAt;
        const bDate = b.lastUsed || b.createdAt;
        return bDate.getTime() - aDate.getTime();
      });
      templates.splice(MAX_TEMPLATES);
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));

    return newTemplate;
  } catch (err) {
    logError('Failed to save mapping template:', err);
    throw new Error('Failed to save mapping template');
  }
}

/**
 * Delete a mapping template
 */
export function deleteMappingTemplate(templateId: string): boolean {
  try {
    const templates = loadMappingTemplates();
    const filteredTemplates = templates.filter(t => t.id !== templateId);

    if (filteredTemplates.length === templates.length) {
      warn(`Template with ID ${templateId} not found`);
      return false;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredTemplates));
    return true;
  } catch (err) {
    logError('Failed to delete mapping template:', err);
    return false;
  }
}

/**
 * Update last used timestamp for a template
 */
export function updateTemplateLastUsed(templateId: string): void {
  try {
    const templates = loadMappingTemplates();
    const template = templates.find(t => t.id === templateId);

    if (template) {
      template.lastUsed = new Date();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    }
  } catch (err) {
    logError('Failed to update template last used:', err);
  }
}

/**
 * Calculate similarity between two column lists
 */
function calculateColumnListSimilarity(columns1: string[], columns2: string[]): number {
  if (columns1.length === 0 || columns2.length === 0) return 0;

  // Calculate how many columns match
  let matchCount = 0;
  const normalizedColumns2 = columns2.map(c => c.toLowerCase().trim());

  for (const col1 of columns1) {
    const normalized1 = col1.toLowerCase().trim();

    // Exact match
    if (normalizedColumns2.includes(normalized1)) {
      matchCount++;
      continue;
    }

    // Similar match (using similarity function from columnDetection)
    const bestSimilarity = Math.max(
      ...normalizedColumns2.map(col2 => {
        const s1 = normalized1;
        const s2 = col2;

        // Simple similarity check
        if (s1 === s2) return 1;
        if (s1.includes(s2) || s2.includes(s1)) return 0.8;

        // Levenshtein-like approximation
        const len1 = s1.length;
        const len2 = s2.length;
        const maxLen = Math.max(len1, len2);

        let matches = 0;
        for (let i = 0; i < Math.min(len1, len2); i++) {
          if (s1[i] === s2[i]) matches++;
        }

        return matches / maxLen;
      })
    );

    if (bestSimilarity >= 0.7) {
      matchCount += bestSimilarity;
    }
  }

  // Calculate similarity score (0-1)
  const avgLength = (columns1.length + columns2.length) / 2;
  return matchCount / avgLength;
}

/**
 * Find the best matching template for given file columns
 */
export function findMatchingTemplate(
  fileColumns: string[],
  minSimilarity: number = 0.7
): ImportMappingTemplate | null {
  try {
    const templates = loadMappingTemplates();

    if (templates.length === 0) return null;

    // Calculate similarity for each template
    const scored = templates.map(template => ({
      template,
      similarity: calculateColumnListSimilarity(fileColumns, template.fileColumns)
    }));

    // Sort by similarity
    scored.sort((a, b) => b.similarity - a.similarity);

    // Return best match if above threshold
    const best = scored[0];
    if (best.similarity >= minSimilarity) {
      return best.template;
    }

    return null;
  } catch (err) {
    logError('Failed to find matching template:', err);
    return null;
  }
}

/**
 * Get recently used templates (sorted by last used date)
 */
export function getRecentTemplates(limit: number = 5): ImportMappingTemplate[] {
  try {
    const templates = loadMappingTemplates();

    // Filter templates that have been used
    const usedTemplates = templates.filter(t => t.lastUsed);

    // Sort by last used date (most recent first)
    usedTemplates.sort((a, b) => {
      const aDate = a.lastUsed || a.createdAt;
      const bDate = b.lastUsed || b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });

    return usedTemplates.slice(0, limit);
  } catch (err) {
    logError('Failed to get recent templates:', err);
    return [];
  }
}

/**
 * Export templates to JSON file
 */
export function exportTemplates(): void {
  try {
    const templates = loadMappingTemplates();
    const json = JSON.stringify(templates, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trade-import-templates-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    logError('Failed to export templates:', err);
    throw new Error('Failed to export templates');
  }
}

/**
 * Import templates from JSON file
 */
export function importTemplates(jsonData: string): number {
  try {
    const importedTemplates = JSON.parse(jsonData) as ImportMappingTemplate[];
    const currentTemplates = loadMappingTemplates();

    let importedCount = 0;

    for (const template of importedTemplates) {
      // Check if template already exists
      const exists = currentTemplates.some(t => t.id === template.id);

      if (!exists) {
        // Parse dates
        template.createdAt = new Date(template.createdAt);
        if (template.lastUsed) {
          template.lastUsed = new Date(template.lastUsed);
        }

        currentTemplates.push(template);
        importedCount++;
      }
    }

    // Save updated templates
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentTemplates));

    return importedCount;
  } catch (err) {
    logError('Failed to import templates:', err);
    throw new Error('Failed to import templates');
  }
}

/**
 * Clear all saved templates
 */
export function clearAllTemplates(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    logError('Failed to clear templates:', err);
    return false;
  }
}
