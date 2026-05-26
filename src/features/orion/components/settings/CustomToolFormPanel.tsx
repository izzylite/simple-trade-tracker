// Inline form panel for create + edit. Rendered DIRECTLY inside the
// CustomToolsSection card (expanded state) — not in a separate dialog.
// Mirrors the TradeDetailExpanded pattern: click the card's expand
// chevron, the panel slides down with the full wizard inside, action
// buttons live at the bottom of the panel itself.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useDialogTokens } from 'styles/dialogTokens';
import {
  auditSchema,
  draftSchema,
  editTool,
  saveTool,
  testFire,
} from 'features/orion/services/customToolsService';
import type {
  ArgsSchema,
  AuditResult,
  CustomToolListEntry,
  DraftedSchemaResponse,
  TestFireResult,
} from 'features/orion/types/customTool';
import { isValidHttpsUrl, isValidName } from './customToolFormHelpers';
import DescribeStep from './DescribeStep';
import ReviewStep from './ReviewStep';
import SecretRevealBox from './SecretRevealBox';
import StepRail from './StepRail';
import VerifyStep from './VerifyStep';
import WebhookDocsAccordion from './WebhookDocsAccordion';

interface Props {
  /** Provide an existing tool to open in EDIT mode (Edit + Verify steps).
   *  Omit / null for CREATE mode (Describe + Review + Secret + Verify). */
  existingTool?: CustomToolListEntry | null;
  /** Fires when the user cancels (Back from step 0 or external collapse).
   *  Parent should collapse the expanded card. */
  onClose: () => void;
  /** Fires after a successful save / edit. Parent should collapse the
   *  panel AND refresh the tool list. */
  onSaved: () => void;
}

const CREATE_STEPS = ['Describe', 'Review', 'Secret', 'Verify'] as const;
const EDIT_STEPS = ['Edit', 'Verify'] as const;

const CustomToolFormPanel: React.FC<Props> = ({
  existingTool = null,
  onClose,
  onSaved,
}) => {
  const theme = useTheme();
  const tokens = useDialogTokens();
  const isEditMode = existingTool !== null;
  const steps = isEditMode ? EDIT_STEPS : CREATE_STEPS;

  const [step, setStep] = useState(0);
  const [description, setDescription] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<DraftedSchemaResponse | null>(null);
  const [name, setName] = useState('');
  const [formalDescription, setFormalDescription] = useState('');
  const [argsSchemaJson, setArgsSchemaJson] = useState('');
  const [sampleArgsJson, setSampleArgsJson] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestFireResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auditResult !== null) setAuditResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, formalDescription, argsSchemaJson]);
  useEffect(() => {
    if (testResult !== null) setTestResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webhookUrl, argsSchemaJson, sampleArgsJson]);

  // Prefill on mount. Unlike the dialog this fires once on mount because
  // the panel is unmounted on collapse — no need to re-prefill on prop
  // change.
  useEffect(() => {
    if (existingTool) {
      setStep(0);
      setWebhookUrl(existingTool.webhook_url);
      setName(existingTool.name);
      setFormalDescription(existingTool.description);
      setArgsSchemaJson(JSON.stringify(existingTool.args_schema, null, 2));
      const synth: Record<string, unknown> = {};
      const props = existingTool.args_schema.properties ?? {};
      for (const k of existingTool.args_schema.required ?? []) {
        const prop = (props as Record<string, { type?: string }>)[k];
        synth[k] = prop?.type === 'number' || prop?.type === 'integer'
          ? 0
          : prop?.type === 'boolean'
            ? false
            : '';
      }
      setSampleArgsJson(JSON.stringify(synth, null, 2));
      setIsReadOnly(existingTool.is_read_only);
      setDraft({
        name: existingTool.name,
        registered_name: existingTool.registered_name,
        description: existingTool.description,
        args_schema: existingTool.args_schema,
        sample_args: synth,
        secret: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const delta = useMemo(() => {
    if (!existingTool) return null;
    const parsedSchema = (() => {
      try { return JSON.parse(argsSchemaJson); } catch { return null; }
    })();
    return {
      name: name !== existingTool.name,
      description: formalDescription !== existingTool.description,
      args_schema: parsedSchema !== null &&
        JSON.stringify(parsedSchema) !== JSON.stringify(existingTool.args_schema),
      webhook_url: webhookUrl !== existingTool.webhook_url,
      is_read_only: isReadOnly !== existingTool.is_read_only,
    };
  }, [existingTool, name, formalDescription, argsSchemaJson, webhookUrl, isReadOnly]);

  const anyFieldChanged = delta !== null && (
    delta.name || delta.description || delta.args_schema ||
    delta.webhook_url || delta.is_read_only
  );
  const auditRequired = delta !== null && (delta.name || delta.description || delta.args_schema);
  const testRequired = delta !== null && (delta.webhook_url || delta.args_schema);

  const parsedArgsSchema = (): ArgsSchema | null => {
    try {
      const v = JSON.parse(argsSchemaJson);
      if (!v || typeof v !== 'object' || v.type !== 'object' || !v.properties) return null;
      return v as ArgsSchema;
    } catch {
      return null;
    }
  };

  const parsedSampleArgs = (): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(sampleArgsJson || '{}');
      if (!v || typeof v !== 'object') return null;
      return v as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const handleDraft = async () => {
    setError(null);
    setDrafting(true);
    try {
      const d = await draftSchema({ description, webhook_url: webhookUrl });
      setDraft(d);
      setName(d.name);
      setFormalDescription(d.description);
      setArgsSchemaJson(JSON.stringify(d.args_schema, null, 2));
      setSampleArgsJson(JSON.stringify(d.sample_args, null, 2));
      setAuditResult(null);
      setTestResult(null);
      setStep(1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDrafting(false);
    }
  };

  const handleAudit = async () => {
    const schema = parsedArgsSchema();
    if (!schema) {
      setError('Tool inputs JSON is invalid. Check the Advanced section.');
      return;
    }
    setAuditing(true);
    try {
      const a = await auditSchema({ name, description: formalDescription, args_schema: schema });
      setAuditResult(a);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAuditing(false);
    }
  };

  const handleTest = async () => {
    if (!draft) return;
    const sample = parsedSampleArgs();
    if (sample === null) {
      setError('Sample inputs JSON is invalid. Check the Advanced section.');
      return;
    }
    setTesting(true);
    try {
      const t = await testFire({
        webhook_url: webhookUrl,
        sample_args: sample,
        ...(isEditMode && existingTool
          ? { tool_id: existingTool.id }
          : { secret: draft.secret }),
        registered_name: `user_tool_${name}`,
      });
      setTestResult(t);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    const wantAudit = isEditMode ? auditRequired : !auditResult;
    const wantTest = isEditMode ? testRequired : !testResult;
    if (wantAudit) await handleAudit();
    if (wantTest) await handleTest();
  };

  const handleSave = async () => {
    if (!draft) return;
    const schema = parsedArgsSchema();
    if (!schema) {
      setError('Tool inputs JSON is invalid. Check the Advanced section.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (isEditMode && existingTool && delta) {
        const patch: Parameters<typeof editTool>[0] = { id: existingTool.id };
        if (delta.name) patch.name = name;
        if (delta.description) patch.description = formalDescription;
        if (delta.args_schema) patch.args_schema = schema;
        if (delta.webhook_url) patch.webhook_url = webhookUrl;
        if (delta.is_read_only) patch.is_read_only = isReadOnly;
        if (testResult && (delta.webhook_url || delta.args_schema)) {
          patch.baseline_sample = testResult.baseline_sample;
        }
        await editTool(patch);
      } else {
        if (!testResult) return;
        await saveTool({
          name,
          description: formalDescription,
          args_schema: schema,
          webhook_url: webhookUrl,
          secret: draft.secret,
          is_read_only: isReadOnly,
          baseline_sample: testResult.baseline_sample,
        });
      }
      // Defense-in-depth: actively null the in-memory draft (which holds
      // the webhook secret for create mode) before handing off. React's
      // GC handles unmounted state, but for a "shown once" secret we'd
      // rather not rely on lifecycle timing.
      setDraft(null);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const urlOk = isValidHttpsUrl(webhookUrl);
  const nameOk = isValidName(name);

  const isVerifyStep = step === steps.length - 1;
  const isSecretStep = !isEditMode && step === 2;
  const isReviewStep = isEditMode ? step === 0 : step === 1;
  const isDescribeStep = !isEditMode && step === 0;

  const canAdvance = (() => {
    if (isDescribeStep) return description.trim().length >= 10 && urlOk && !drafting;
    if (isReviewStep) {
      const schemaOk = parsedArgsSchema() !== null;
      const sampleOk = parsedSampleArgs() !== null;
      const reviewUrlOk = isEditMode ? urlOk : true;
      if (isEditMode && !anyFieldChanged) return false;
      return nameOk && formalDescription.trim().length >= 10 && schemaOk && sampleOk && reviewUrlOk;
    }
    if (isSecretStep) return true;
    return false;
  })();

  const verifyPassed = (() => {
    if (isEditMode) {
      if (auditRequired && (auditResult === null || auditResult.status === 'fail')) return false;
      if (testRequired && (testResult === null || testResult.overall === 'fail')) return false;
      return anyFieldChanged;
    }
    return (
      auditResult !== null && auditResult.status !== 'fail' &&
      testResult !== null && testResult.overall !== 'fail'
    );
  })();

  const verifying = auditing || testing;

  const verifyButtonLabel = (() => {
    if (verifying) return 'Verifying…';
    const wantAudit = isEditMode ? auditRequired : !auditResult;
    const wantTest = isEditMode ? testRequired : !testResult;
    if (wantAudit && wantTest) return 'Run verification';
    if (wantTest) return 'Re-test webhook';
    if (wantAudit) return 'Re-run audit';
    return verifyPassed ? 'Re-verify' : 'Run verification';
  })();

  const goNext = () => {
    setError(null);
    if (isDescribeStep) {
      void handleDraft();
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goBack = () => {
    setError(null);
    if (step === 0) {
      onClose();
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
  };

  const subtitle = (() => {
    if (isDescribeStep) return 'Tell Orion what your webhook does';
    if (isReviewStep) return isEditMode ? 'Edit your tool settings' : "Confirm what Orion will see when calling your tool";
    if (isSecretStep) return 'Copy your signing secret — shown only once';
    return 'Make sure your webhook responds before saving';
  })();

  const primaryAction = isVerifyStep
    ? (verifyPassed ? handleSave : handleVerify)
    : goNext;

  const primaryLabel = isVerifyStep
    ? (verifyPassed
      ? (isEditMode ? 'Save changes' : 'Save tool')
      : verifyButtonLabel)
    : (drafting ? 'Drafting…' : 'Next');

  const primaryDisabled = (() => {
    if (saving) return true;
    if (isVerifyStep) return verifying;
    return !canAdvance;
  })();

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.25 }, py: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: 'text.tertiary', display: 'block', mb: 1 }}
          >
            {subtitle}
          </Typography>
          <StepRail steps={steps} current={step} />
        </Box>

        {isDescribeStep && (
          <DescribeStep
            description={description}
            setDescription={setDescription}
            webhookUrl={webhookUrl}
            setWebhookUrl={setWebhookUrl}
            urlOk={urlOk}
            drafting={drafting}
          />
        )}

        {isReviewStep && draft && (
          <ReviewStep
            isEditMode={isEditMode}
            webhookUrl={webhookUrl}
            setWebhookUrl={setWebhookUrl}
            urlOk={urlOk}
            name={name}
            setName={setName}
            nameOk={nameOk}
            formalDescription={formalDescription}
            setFormalDescription={setFormalDescription}
            argsSchemaJson={argsSchemaJson}
            setArgsSchemaJson={setArgsSchemaJson}
            sampleArgsJson={sampleArgsJson}
            setSampleArgsJson={setSampleArgsJson}
            isReadOnly={isReadOnly}
            setIsReadOnly={setIsReadOnly}
          />
        )}

        {isSecretStep && draft && (
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Orion signs every webhook request with this secret. Paste it into your
              webhook code now — we won't show it again. If you lose it you'll need to
              delete the tool and re-register.
            </Typography>
            <SecretRevealBox secret={draft.secret} onCopyError={setError} />
            <WebhookDocsAccordion />
          </Stack>
        )}

        {isVerifyStep && draft && (
          <VerifyStep
            isEditMode={isEditMode}
            anyFieldChanged={anyFieldChanged}
            auditing={auditing}
            testing={testing}
            auditResult={auditResult}
            testResult={testResult}
          />
        )}

        {error && (
          <Box
            sx={{
              p: 1.25,
              borderRadius: 1.25,
              border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
              backgroundColor: alpha(theme.palette.error.main, 0.08),
            }}
          >
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          </Box>
        )}

        <Divider />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Button
            onClick={goBack}
            disabled={drafting || verifying || saving}
            sx={tokens.ghostButtonSx}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            onClick={primaryDisabled ? undefined : primaryAction}
            disabled={primaryDisabled}
            variant="contained"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              minHeight: 0,
              px: 1.75,
              py: 0.75,
            }}
          >
            {primaryLabel}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
};

export default CustomToolFormPanel;
