/**
 * Import System Type Definitions
 * Types for the modular import system with column mapping
 */

import { Trade } from './dualWrite';

/**
 * Supported data types for import fields
 */
export type FieldType = 'string' | 'number' | 'date' | 'boolean' | 'array';

/**
 * Trade fields that can be mapped
 */
export type TradeField =
  | 'name'
  | 'amount'
  | 'trade_type'
  | 'trade_date'
  | 'entry_price'
  | 'exit_price'
  | 'stop_loss'
  | 'take_profit'
  | 'risk_to_reward'
  | 'partials_taken'
  | 'session'
  | 'notes'
  | 'tags'
  | 'images';

/**
 * Special mapping actions
 */
export type MappingAction = 'ignore' | 'create_tag';

/**
 * Mapping target can be a trade field or a special action
 */
export type MappingTarget = TradeField | MappingAction;

/**
 * Field metadata describing expected type and requirements
 */
export interface FieldMetadata {
  name: TradeField;
  displayName: string;
  type: FieldType;
  required: boolean;
  description: string;
  examples?: string[];
}

/**
 * Mapping of a file column to an app field or action
 */
export interface ColumnMapping {
  fileColumn: string;
  target: MappingTarget;
  confidence?: number; // 0-100, confidence of auto-detection
  autoDetected?: boolean;
}

/**
 * Validation error severity levels
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation error for a specific cell/row
 */
export interface ValidationError {
  row: number;
  column: string;
  field?: TradeField;
  severity: ValidationSeverity;
  message: string;
  value?: any;
  suggestedFix?: string;
}

/**
 * Type conversion information
 */
export interface TypeConversion {
  field: TradeField;
  fromType: string;
  toType: FieldType;
  affectedRows: number;
  examples: Array<{ original: any; converted: any }>;
  warnings: number;
}

/**
 * Preview row with validation status
 */
export interface ImportPreviewRow {
  rowIndex: number;
  data: Record<string, any>;
  mappedData: Partial<Trade>;
  errors: ValidationError[];
  warnings: ValidationError[];
  isValid: boolean;
}

/**
 * Validation summary for the entire import
 */
export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  rowsWithWarnings: number;
  rowsWithErrors: number;
  willImport: number;
  conversions: TypeConversion[];
  errors: ValidationError[];
}

/**
 * Saved mapping template
 */
export interface ImportMappingTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  lastUsed?: Date;
  columnMappings: ColumnMapping[];
  fileColumns: string[]; // Original column names for matching
}

/**
 * Raw data from imported file
 */
export interface ImportFileData {
  columns: string[];
  rows: Array<Record<string, any>>;
  fileType: 'xlsx' | 'csv';
  fileName: string;
  rowCount: number;
}

/**
 * Import configuration
 */
export interface ImportConfig {
  skipErrorRows: boolean;
  createTagsFromUnmapped: boolean;
  defaultValues?: Partial<Trade>;
  dateFormat?: string;
  numberFormat?: 'us' | 'eu'; // US: 1,234.56 | EU: 1.234,56
}

/**
 * Complete import state
 */
export interface ImportState {
  fileData: ImportFileData | null;
  columnMappings: ColumnMapping[];
  previewRows: ImportPreviewRow[];
  validationSummary: ValidationSummary;
  config: ImportConfig;
  currentStep: ImportStep;
  isProcessing: boolean;
  error?: string;
}

/**
 * Import wizard steps
 */
export type ImportStep = 'upload' | 'mapping' | 'preview' | 'confirm';

/**
 * Column match suggestion
 */
export interface ColumnSuggestion {
  fileColumn: string;
  suggestedField: TradeField | null;
  confidence: number;
  reason: string;
}
