/**
 * Import Mapping Storage Utility
 * Manages saving and loading of import mapping templates
 */

import { ImportMappingTemplate, ColumnMapping } from '../types/import';
import { warn, error as logError } from 'utils/logger';

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

