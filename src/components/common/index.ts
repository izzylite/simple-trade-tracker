export { default as AppHeader } from 'components/common/AppHeader';
export { default as BaseDialog } from 'components/common/BaseDialog';
export { default as TagsDisplay } from 'components/common/TagsDisplay';
export { default as ConfirmationDialog } from 'components/common/ConfirmationDialog';
// RichTextEditor intentionally NOT re-exported — pulls draft-js + immutable
// (~80KB raw) into anything that imports the barrel. Consumers must import
// it directly from 'components/common/RichTextEditor' so the eager pull stays scoped.
export { default as Breadcrumbs } from 'components/common/Breadcrumbs';
export type { BreadcrumbItem } from 'components/common/Breadcrumbs';
export {
  TextInput,
  SelectInput,
  AutocompleteInput,
  FormSection,
  FormRow,
  FormActions
} from 'components/common/FormField';
