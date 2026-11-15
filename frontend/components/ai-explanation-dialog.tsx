'use client';
import { X, Sparkles, CheckCircle2, AlertTriangle, Database, ArrowRight, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import type { AiExplanation, Lang } from '@/lib/types';
import type { Copy } from '@/lib/i18n';

export default function AiExplanationDialog({
  explanation,
  t,
  lang,
  onClose,
}: {
  explanation: AiExplanation;
  t: Copy;
  lang: Lang;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-dialog-title"
        className="editor ai-dialog"
        style={{ maxWidth: 680 }}
      >
        <header>
          <div>
            <p className="eyebrow flex items-center gap-1.5" style={{ color: '#176B45' }}>
              <Sparkles size={16} /> FIELDSHIFT EXPLAINABLE AI
            </p>
            <h2 id="ai-dialog-title">{t.aiExplanationTitle}</h2>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label={t.cancel}>
            <X size={18} />
          </Button>
        </header>

        <div className="space-y-5" style={{ padding: '1.25rem 0' }}>
          {/* Executive Summary */}
          <div
            style={{
              background: '#f4f8f2',
              border: '1px solid #d4e7cd',
              borderRadius: 12,
              padding: '1rem 1.25rem',
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
              <span className="tag green" style={{ fontWeight: 600 }}>
                {explanation.recommended_title}
              </span>
              <span className="text-sm font-semibold" style={{ color: '#0B3D2E' }}>
                {explanation.score} / 100 {t.score}
              </span>
            </div>
            <p style={{ color: '#17251C', fontSize: '0.95rem', lineHeight: 1.55 }}>
              {explanation.summary}
            </p>
            {explanation.runner_up_comparison && (
              <p className="muted small" style={{ marginTop: '0.5rem', borderTop: '1px dashed #d4e7cd', paddingTop: '0.5rem' }}>
                {explanation.runner_up_comparison}
              </p>
            )}
          </div>

          {/* Key Agronomic Factors */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0B3D2E' }}>
              {t.whyWinnerTitle}
            </h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {explanation.factors.map((factor, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    fontSize: '0.88rem',
                    color: '#2a3b30',
                    lineHeight: 1.45,
                  }}
                >
                  <CheckCircle2 size={16} style={{ color: '#176B45', flexShrink: 0, marginTop: 2 }} />
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actionable Next Steps */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0B3D2E' }}>
              {t.actionsTitle}
            </h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {explanation.next_actions.map((act, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    fontSize: '0.88rem',
                    color: '#2a3b30',
                    lineHeight: 1.45,
                  }}
                >
                  <ArrowRight size={16} style={{ color: '#70B86B', flexShrink: 0, marginTop: 2 }} />
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Data Sources Provenance */}
          <div style={{ borderTop: '1px solid #e8ede5', paddingTop: '1rem' }}>
            <h4 className="eyebrow" style={{ color: '#738078', marginBottom: '0.5rem' }}>
              {t.sourcesUsedTitle}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {explanation.data_sources.map((src, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs"
                  style={{
                    background: '#f8f9f5',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 8,
                    border: '1px solid #e8ece5',
                  }}
                >
                  <div>
                    <strong style={{ color: '#0B3D2E' }}>{src.name}</strong> · {src.product}
                  </div>
                  <span className="muted">{src.period}</span>
                </div>
              ))}
            </div>
            <p className="micro muted" style={{ marginTop: '0.5rem' }}>
              {t.nasaHint} · Model: {explanation.model_version}
            </p>
          </div>
        </div>

        <footer>
          <Button onClick={onClose} style={{ marginLeft: 'auto' }}>
            {t.back}
          </Button>
        </footer>
      </section>
    </div>
  );
}
