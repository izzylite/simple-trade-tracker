/**
 * @deprecated Re-export shim. New code should import directly from
 * `components/common/CardShell`. The shell, header band, icon-pill, and
 * eyebrow primitives all live there now; this file exists only so prior
 * `import PerfCard from 'features/performance/components/PerfCard'`
 * call sites keep working.
 */
export { default } from 'components/common/CardShell';
export type { CardShellProps as PerfCardProps, CardHeadProps as PerfCardHeadProps } from 'components/common/CardShell';
